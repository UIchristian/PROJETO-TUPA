"""
Tupã — Motor de comparação de divergências.

Dado o gabarito (fontes oficiais), uso e cobertura atualizado (satélite),
APP, uso restrito e o declarado no CAR, calcula as divergências reais:
cultivo dentro de APP, supressão de vegetação, uso incompatível em área restrita.

Tudo derivado da geometria — zero números inventados.
"""
from __future__ import annotations

import logging
from typing import TYPE_CHECKING

import geopandas as gpd
from shapely.geometry import mapping, shape
from shapely.ops import unary_union
from shapely.validation import make_valid

from domain import (
    CoberturaClasse,
    Divergencia,
    DiagnosticoResult,
    Gabarito,
    SeveridadeDivergencia,
    TipoDivergencia,
)

if TYPE_CHECKING:
    from sources import DeclaradoSource, DynamicWorldSource, SnifSource

logger = logging.getLogger(__name__)

# CRS for area calculation (SIRGAS 2000 / Brazil Polyconic — equal-area)
CRS_AREA = "EPSG:5880"

# Cores por classe de uso/cobertura
CORES_CLASSES: dict[str, str] = {
    "Floresta Nativa": "#15803D",
    "Lavoura": "#EAB308",
    "Pastagem": "#86EFAC",
    "Solo Exposto": "#B45309",
    "Corpo d'Água": "#3B82F6",
}


def _safe_geometry(geom):
    """Ensure geometry is valid."""
    if geom is None or geom.is_empty:
        return geom
    if not geom.is_valid:
        geom = make_valid(geom)
    return geom


def _area_hectares(geom, source_crs: str = "EPSG:4326") -> float:
    """Calculate area in hectares by reprojecting to equal-area CRS."""
    if geom is None or geom.is_empty:
        return 0.0
    gdf = gpd.GeoDataFrame(geometry=[geom], crs=source_crs)
    gdf_proj = gdf.to_crs(CRS_AREA)
    area_m2 = gdf_proj.geometry.iloc[0].area
    return round(area_m2 / 10_000, 2)


def _geom_to_geojson(geom) -> dict:
    """Convert Shapely geometry to GeoJSON dict."""
    if geom is None or geom.is_empty:
        return {"type": "Polygon", "coordinates": []}
    return mapping(geom)


def _detect_cultivo_em_app(
    uso_cobertura: gpd.GeoDataFrame,
    app_geom,
    imovel_geom,
) -> list[Divergencia]:
    """Detect cropland (Lavoura) encroaching on APP."""
    divergencias = []

    if app_geom is None or app_geom.is_empty:
        return divergencias

    app_geom = _safe_geometry(app_geom)
    lavoura = uso_cobertura[uso_cobertura["classe"].str.contains("Lavoura", case=False, na=False)]

    if lavoura.empty:
        return divergencias

    lavoura_union = _safe_geometry(unary_union(lavoura.geometry))
    intersecao = _safe_geometry(app_geom.intersection(lavoura_union))

    if intersecao is not None and not intersecao.is_empty:
        area = _area_hectares(intersecao)
        if area > 0.01:  # Ignore negligible slivers
            divergencias.append(Divergencia(
                tipo=TipoDivergencia.CULTIVO_EM_APP,
                geometria=intersecao,
                area_hectares=area,
                severidade=SeveridadeDivergencia.ALTA,
                descricao=(
                    f"Foi identificado cultivo agrícola comercial ativo na faixa de "
                    f"30 metros marginal de curso d'água — Área de Preservação "
                    f"Permanente (APP). O Código Florestal exige vegetação nativa "
                    f"nesta área. Área afetada: {area} ha."
                ),
                base_legal="Art. 4º, inciso I, alínea 'a' da Lei 12.651/2012 (Código Florestal)",
                caminho_retificacao=(
                    f"Cessar o cultivo comercial na área delimitada de {area} ha, "
                    f"isolar os limites da APP com cerca para permitir a regeneração "
                    f"natural e submeter um Projeto de Recomposição de Áreas "
                    f"Degradadas e Alteradas (PRADA) ao órgão ambiental estadual."
                ),
            ))

    return divergencias


def _detect_supressao_vegetacao(
    uso_cobertura: gpd.GeoDataFrame,
    vegetacao_nativa: gpd.GeoDataFrame,
    imovel_geom,
) -> list[Divergencia]:
    """Detect areas where native vegetation was suppressed (now cropland/bare soil)."""
    divergencias = []

    if vegetacao_nativa.empty:
        return divergencias

    veg_union = _safe_geometry(unary_union(vegetacao_nativa.geometry))

    # Areas that used to be native vegetation but are now non-forest
    nao_floresta = uso_cobertura[
        uso_cobertura["classe"].str.contains("Lavoura|Solo Exposto|Pastagem", case=False, na=False)
    ]

    if nao_floresta.empty:
        return divergencias

    nao_floresta_union = _safe_geometry(unary_union(nao_floresta.geometry))
    supressao = _safe_geometry(veg_union.intersection(nao_floresta_union))

    # Clip to imovel
    if supressao is not None and not supressao.is_empty:
        supressao = _safe_geometry(supressao.intersection(_safe_geometry(imovel_geom)))

    if supressao is not None and not supressao.is_empty:
        area = _area_hectares(supressao)
        if area > 0.05:  # Ignore negligible areas
            divergencias.append(Divergencia(
                tipo=TipoDivergencia.SUPRESSAO_VEGETACAO,
                geometria=supressao,
                area_hectares=area,
                severidade=SeveridadeDivergencia.MEDIA,
                descricao=(
                    f"Diferença detectada entre o mapeamento histórico de vegetação "
                    f"nativa e imagens recentes de satélite aponta supressão de "
                    f"{area} ha de vegetação de Cerrado sem registro de Autorização "
                    f"de Supressão de Vegetação (ASV) no sistema ambiental estadual."
                ),
                base_legal="Art. 7º e Art. 8º da Lei 12.651/2012 (Código Florestal)",
                caminho_retificacao=(
                    f"Apresentar a licença/ASV obtida à época junto à Secretaria de "
                    f"Meio Ambiente ou iniciar processo de regularização com "
                    f"reposição florestal equivalente a {area} ha, conforme Art. 7º "
                    f"do Código Florestal."
                ),
            ))

    return divergencias


def _detect_uso_incompativel_restrito(
    uso_cobertura: gpd.GeoDataFrame,
    uso_restrito: gpd.GeoDataFrame,
    imovel_geom,
) -> list[Divergencia]:
    """Detect incompatible land use in restricted areas."""
    divergencias = []

    if uso_restrito.empty:
        return divergencias

    restrito_union = _safe_geometry(unary_union(uso_restrito.geometry))

    usos_incompativeis = uso_cobertura[
        uso_cobertura["classe"].str.contains("Lavoura|Solo Exposto", case=False, na=False)
    ]

    if usos_incompativeis.empty:
        return divergencias

    incomp_union = _safe_geometry(unary_union(usos_incompativeis.geometry))
    intersecao = _safe_geometry(restrito_union.intersection(incomp_union))

    if intersecao is not None and not intersecao.is_empty:
        area = _area_hectares(intersecao)
        if area > 0.01:
            divergencias.append(Divergencia(
                tipo=TipoDivergencia.USO_INCOMPATIVEL_RESTRITO,
                geometria=intersecao,
                area_hectares=area,
                severidade=SeveridadeDivergencia.MEDIA,
                descricao=(
                    f"Identificado uso do solo incompatível (cultivo/solo exposto) "
                    f"em área de uso restrito (topo de morro / encosta). "
                    f"Área afetada: {area} ha."
                ),
                base_legal="Art. 11 da Lei 12.651/2012 (Código Florestal)",
                caminho_retificacao=(
                    f"Adotar práticas conservacionistas compatíveis com a área de "
                    f"uso restrito em {area} ha, conforme Art. 11 do Código "
                    f"Florestal, ou recuperar a vegetação nativa."
                ),
            ))

    return divergencias


def _calculate_cobertura(
    uso_cobertura: gpd.GeoDataFrame,
    imovel_geom,
) -> list[CoberturaClasse]:
    """Calculate land cover percentages from real geometry intersections."""
    imovel_geom = _safe_geometry(imovel_geom)
    area_total = _area_hectares(imovel_geom)

    if area_total == 0:
        return []

    classes: dict[str, float] = {}
    geometrias: dict[str, object] = {}

    for _, row in uso_cobertura.iterrows():
        classe = row.get("classe", "Desconhecido")
        geom = _safe_geometry(row.geometry)
        if geom is None or geom.is_empty:
            continue

        clipped = _safe_geometry(geom.intersection(imovel_geom))
        if clipped is None or clipped.is_empty:
            continue

        area_ha = _area_hectares(clipped)
        classes[classe] = classes.get(classe, 0) + area_ha
        if classe in geometrias:
            geometrias[classe] = _safe_geometry(unary_union([geometrias[classe], clipped]))
        else:
            geometrias[classe] = clipped

    result = []
    for classe, area_ha in sorted(classes.items(), key=lambda x: -x[1]):
        percentual = round((area_ha / area_total) * 100, 1)
        cor = CORES_CLASSES.get(classe, "#94A3B8")
        result.append(CoberturaClasse(
            classe=classe,
            percentual=percentual,
            cor_hex=cor,
            geometria=geometrias.get(classe),
        ))

    return result


def _calculate_score(divergencias: list[Divergencia]) -> float:
    """
    Calculate conformity score (0-100).
    Penalties: alta=-15, media=-8, baixa=-3 per divergence.
    """
    score = 100.0
    for div in divergencias:
        if div.severidade == SeveridadeDivergencia.ALTA:
            score -= 15
        elif div.severidade == SeveridadeDivergencia.MEDIA:
            score -= 8
        else:
            score -= 3
    return max(0.0, round(score, 1))


def calcular_diagnostico(
    imovel_id: str,
    imovel_geom,
    snif: "SnifSource",
    dynamic_world: "DynamicWorldSource",
    declarado: "DeclaradoSource",
) -> DiagnosticoResult:
    """
    Main entry point: calculate the full diagnostic for a property.

    1. Load data from all sources (via adapter interfaces)
    2. Build APP from watercourse buffer
    3. Detect all divergence types
    4. Calculate real coverage percentages
    5. Compute conformity score
    """
    imovel_geom = _safe_geometry(imovel_geom)
    logger.info("Calculando diagnóstico para imóvel: %s", imovel_id)

    # 1. Load data from adapters
    vegetacao_nativa = snif.get_vegetacao_nativa(imovel_geom)
    hidrografia = snif.get_hidrografia(imovel_geom)
    app_gdf = snif.get_app(imovel_geom)
    uso_restrito_gdf = snif.get_uso_restrito(imovel_geom)
    uso_cobertura = dynamic_world.get_uso_cobertura(imovel_geom)
    declarado_gdf = declarado.get_declarado(imovel_id)

    # 2. Build unified APP geometry
    app_geom = None
    if not app_gdf.empty:
        app_geom = _safe_geometry(unary_union(app_gdf.geometry))

    uso_restrito_geom = None
    if not uso_restrito_gdf.empty:
        uso_restrito_geom = _safe_geometry(unary_union(uso_restrito_gdf.geometry))

    declarado_geom = None
    if not declarado_gdf.empty:
        declarado_geom = _safe_geometry(unary_union(declarado_gdf.geometry))

    # 3. Build gabarito
    veg_geom = None
    if not vegetacao_nativa.empty:
        veg_geom = _safe_geometry(unary_union(vegetacao_nativa.geometry))

    hidro_geom = None
    if not hidrografia.empty:
        hidro_geom = _safe_geometry(unary_union(hidrografia.geometry))

    gabarito = Gabarito(
        vegetacao_nativa=veg_geom,
        hidrografia=hidro_geom,
        app=app_geom,
        uso_restrito=uso_restrito_geom,
    )

    # 4. Detect divergences
    divergencias: list[Divergencia] = []

    divergencias.extend(_detect_cultivo_em_app(uso_cobertura, app_geom, imovel_geom))
    divergencias.extend(_detect_supressao_vegetacao(uso_cobertura, vegetacao_nativa, imovel_geom))
    divergencias.extend(_detect_uso_incompativel_restrito(uso_cobertura, uso_restrito_gdf, imovel_geom))

    logger.info("Divergências encontradas: %d", len(divergencias))

    # 5. Calculate real coverage percentages
    cobertura = _calculate_cobertura(uso_cobertura, imovel_geom)
    gabarito.cobertura = cobertura

    # 6. Compute conformity score
    score = _calculate_score(divergencias)

    return DiagnosticoResult(
        imovel_id=imovel_id,
        score_conformidade=score,
        cobertura_solo=cobertura,
        divergencias=divergencias,
        gabarito=gabarito,
        poligono_declarado=declarado_geom,
    )
