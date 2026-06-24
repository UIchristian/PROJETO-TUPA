"""
Tupã — Adapter de cobertura observada via Sentinel-2 (Copernicus).

Complementa o MapBiomas (base histórica anual) com uma leitura *recente* da
cobertura do solo, classificada por limiares de NDVI/NDWI a partir da imagem
Sentinel-2 L2A mais recente com baixa cobertura de nuvens dos últimos dias.

As duas fontes coexistem na tabela `cobertura_observada`, distinguidas pela
coluna `fonte` ('mapbiomas' | 'sentinel'). O motor de divergências (engine.py)
consome ambas pelos MESMOS nomes de classe — por isso aqui reutilizamos a
nomenclatura já existente em sources/mapbiomas.py e nos filtros do engine
('%Lavoura%', 'Solo Exposto', etc.), sem inventar nomes novos.

Crédito obrigatório: "Contains modified Copernicus Sentinel data".
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta

import numpy as np
import rasterio.features
import rasterio.transform
from geoalchemy2.shape import to_shape
from pyproj import Transformer
from shapely.geometry import shape, MultiPolygon, Polygon
from shapely.ops import transform as shapely_transform, unary_union
from shapely.strtree import STRtree
from sqlalchemy.orm import Session

from db.models import Imovel, CoberturaObservada
# Reaproveita a configuração de autenticação do Copernicus, sem duplicar credenciais.
from copernicus import _build_sh_config
from . import BaseSourceAdapter

logger = logging.getLogger(__name__)

# --- Parâmetros de aquisição -------------------------------------------------
JANELA_DIAS = 60                 # imagem dos últimos N dias
MAX_NUVEM_PCT = 30               # descarta cenas acima desta cobertura de nuvem
RESOLUCAO_M = 10                 # resolução alvo (m/pixel) — bandas ópticas do S2
MAX_DIMENSAO_PX = 2500           # teto por eixo (limite da Process API do Sentinel Hub)
COBERTURA_MIN_VALIDA = 0.01      # fração mínima de pixels válidos para usar a cena
TOLERANCIA_SIMPLIFICACAO_M = 5   # simplificação leve dos polígonos (em metros, na grade UTM)

# --- Limiares de classificação (reflectância de superfície, 0–1) -------------
# Convenção por faixas de NDVI/NDWI. Distinguir Pastagem de Lavoura a partir de
# uma única data é aproximado; os limiares ficam aqui como constantes ajustáveis.
NDWI_AGUA = 0.10            # NDWI alto  -> água
NDVI_VEG_NATIVA = 0.65     # NDVI muito alto         -> vegetação nativa densa
NDVI_LAVOURA = 0.45        # NDVI intermediário-alto -> cultura vigorosa
NDVI_PASTAGEM = 0.25       # NDVI intermediário-baixo -> pastagem
SWIR_SOLO_MIN = 0.08       # B11 mínimo p/ confirmar solo seco exposto (separa de sombra)

# Códigos inteiros do raster classificado (0 = sem dado / ignorado).
# Os nomes são exatamente os já usados por mapbiomas.py / engine.py / main.py.
CLASSE_POR_CODIGO = {
    1: "Corpos d'Água",
    2: "Floresta Nativa",
    3: "Lavoura Temporária",
    4: "Pastagem",
    5: "Solo Exposto",
}

# Bandas: verde (B03), vermelho (B04), NIR (B08), SWIR (B11) + máscara de dados.
EVALSCRIPT = """
//VERSION=3
function setup() {
  return {
    input: [{ bands: ["B03", "B04", "B08", "B11", "dataMask"] }],
    output: { bands: 5, sampleType: "FLOAT32" }
  };
}
function evaluatePixel(s) {
  return [s.B03, s.B04, s.B08, s.B11, s.dataMask];
}
"""


class SentinelSourceAdapter(BaseSourceAdapter):
    """Classifica a cobertura recente do solo a partir do Sentinel-2 L2A."""

    FONTE = "sentinel"
    CREDIT_TEXT = "Contains modified Copernicus Sentinel data"

    def load_data(self, municipio: str, db_session: Session):
        logger.info(f"[Sentinel] Iniciando classificação de cobertura para {municipio}...")
        try:
            self._processar(municipio, db_session)
        except Exception as exc:
            # Nunca derruba o orquestrador/aplicação: MapBiomas segue como base.
            db_session.rollback()
            logger.error(f"[Sentinel] Falha ao processar {municipio}: {exc}", exc_info=True)

    # ----------------------------------------------------------------- pipeline
    def _processar(self, municipio: str, db_session: Session):
        imoveis = db_session.query(Imovel).filter(Imovel.municipio == municipio).all()
        if not imoveis:
            logger.info("[Sentinel] Nenhum imóvel no município; nada a fazer.")
            return

        # 1. Área de interesse = bbox que cobre todos os imóveis do município.
        imoveis_geom = []
        for im in imoveis:
            if im.poligono_declarado is None:
                continue
            geom = to_shape(im.poligono_declarado)
            if geom is None or geom.is_empty:
                continue
            imoveis_geom.append((im, geom))

        if not imoveis_geom:
            logger.info("[Sentinel] Imóveis sem geometria declarada; nada a fazer.")
            return

        minx = min(g.bounds[0] for _, g in imoveis_geom)
        miny = min(g.bounds[1] for _, g in imoveis_geom)
        maxx = max(g.bounds[2] for _, g in imoveis_geom)
        maxy = max(g.bounds[3] for _, g in imoveis_geom)

        # 2. Baixa a imagem Sentinel-2 mais recente com baixa nuvem.
        bandas, transform_utm, utm_crs = self._baixar_imagem(minx, miny, maxx, maxy)
        if bandas is None:
            logger.warning(
                f"[Sentinel] Sem imagem com nuvem < {MAX_NUVEM_PCT}% nos últimos "
                f"{JANELA_DIAS} dias para {municipio}. Mantendo apenas a base histórica."
            )
            return

        # 3-4. NDVI/NDWI por pixel + classificação por limiar.
        classificado = self._classificar(bandas)
        if not classificado.any():
            logger.warning(f"[Sentinel] Imagem sem pixels classificáveis para {municipio}.")
            return

        # 5. Vetoriza, simplifica de leve e reprojeta para EPSG:4326.
        poligonos = self._vetorizar(classificado, transform_utm, utm_crs)
        if not poligonos:
            logger.warning(f"[Sentinel] Nenhum polígono gerado para {municipio}.")
            return

        logger.info(self.CREDIT_TEXT)

        # 6. Recorta a cobertura por imóvel, associa o imovel_id e grava.
        total = self._gravar(imoveis_geom, poligonos, db_session)
        logger.info(
            f"[Sentinel] Cobertura recente gravada para {municipio}: "
            f"{total} polígonos em {len(imoveis_geom)} imóveis."
        )

    # ----------------------------------------------------------------- etapa 2
    def _baixar_imagem(self, minx, miny, maxx, maxy):
        """
        Baixa, via sentinelhub, a imagem S2 L2A mais recente e pouco nublada da
        AOI. Retorna (array HxWx5, transform_afim, crs_utm) ou (None, None, None)
        quando não há imagem utilizável.
        """
        try:
            from sentinelhub import (
                CRS,
                BBox,
                DataCollection,
                MimeType,
                SentinelHubRequest,
                bbox_to_dimensions,
            )
        except ImportError as exc:
            logger.error(f"[Sentinel] Dependência 'sentinelhub' ausente: {exc}")
            return None, None, None

        try:
            config = _build_sh_config()
        except ValueError as exc:
            # Credenciais ausentes — só via .env, nunca hardcoded.
            logger.error(f"[Sentinel] {exc}")
            return None, None, None

        # Trabalha em UTM para que resolução/buffers fiquem em metros; o resultado
        # é reprojetado para 4326 na vetorização.
        bbox_wgs = BBox(bbox=[minx, miny, maxx, maxy], crs=CRS.WGS84)
        centro = ((minx + maxx) / 2.0, (miny + maxy) / 2.0)
        utm_crs = CRS.get_utm_from_wgs84(*centro)
        bbox_utm = bbox_wgs.transform(utm_crs)

        # Resolução adaptativa para não estourar o limite de pixels por requisição.
        resolucao = RESOLUCAO_M
        size = bbox_to_dimensions(bbox_utm, resolution=resolucao)
        maior_eixo = max(size)
        if maior_eixo > MAX_DIMENSAO_PX:
            resolucao = resolucao * maior_eixo / MAX_DIMENSAO_PX
            size = bbox_to_dimensions(bbox_utm, resolution=resolucao)
            logger.info(
                f"[Sentinel] AOI extensa: resolução ajustada para ~{resolucao:.1f} m/pixel "
                f"(grade {size[0]}x{size[1]})."
            )

        s2 = DataCollection.SENTINEL2_L2A.define_from(
            name="S2L2A_CDSE", service_url=config.sh_base_url
        )

        fim = datetime.utcnow()
        inicio = fim - timedelta(days=JANELA_DIAS)
        request = SentinelHubRequest(
            evalscript=EVALSCRIPT,
            input_data=[
                SentinelHubRequest.input_data(
                    data_collection=s2,
                    time_interval=(inicio.date().isoformat(), fim.date().isoformat()),
                    other_args={
                        "dataFilter": {
                            "maxCloudCoverage": MAX_NUVEM_PCT,
                            "mosaickingOrder": "mostRecent",
                        }
                    },
                )
            ],
            responses=[SentinelHubRequest.output_response("default", MimeType.TIFF)],
            bbox=bbox_utm,
            size=size,
            config=config,
        )

        dados = request.get_data()
        if not dados:
            return None, None, None

        arr = np.asarray(dados[0], dtype="float32")
        if arr.ndim != 3 or arr.shape[2] < 5:
            logger.warning("[Sentinel] Formato inesperado da imagem retornada.")
            return None, None, None

        # dataMask: fração de pixels válidos (cobertura real da cena na AOI).
        fracao_valida = float(np.count_nonzero(arr[:, :, 4] > 0.5)) / arr[:, :, 4].size
        if fracao_valida < COBERTURA_MIN_VALIDA:
            logger.warning(
                f"[Sentinel] Cobertura útil insuficiente ({fracao_valida:.1%}); "
                "provável excesso de nuvem ou ausência de cena."
            )
            return None, None, None

        transform = rasterio.transform.from_bounds(
            bbox_utm.min_x, bbox_utm.min_y, bbox_utm.max_x, bbox_utm.max_y, size[0], size[1]
        )
        return arr, transform, utm_crs

    # --------------------------------------------------------------- etapa 3-4
    @staticmethod
    def _classificar(arr: np.ndarray) -> np.ndarray:
        """Calcula NDVI/NDWI por pixel e classifica por limiar (uint8, 0 = ignorado)."""
        b03 = arr[:, :, 0]
        b04 = arr[:, :, 1]
        b08 = arr[:, :, 2]
        b11 = arr[:, :, 3]
        mask_valida = arr[:, :, 4] > 0.5

        with np.errstate(divide="ignore", invalid="ignore"):
            ndvi = (b08 - b04) / (b08 + b04)
            ndwi = (b03 - b08) / (b03 + b08)
        ndvi = np.nan_to_num(ndvi, nan=-1.0, posinf=-1.0, neginf=-1.0)
        ndwi = np.nan_to_num(ndwi, nan=-1.0, posinf=-1.0, neginf=-1.0)

        classe = np.zeros(arr.shape[:2], dtype="uint8")
        # A ordem importa: água primeiro, depois faixas de NDVI do mais alto ao mais baixo.
        classe[ndwi >= NDWI_AGUA] = 1                                          # Corpos d'Água
        classe[(classe == 0) & (ndvi >= NDVI_VEG_NATIVA)] = 2                  # Floresta Nativa
        classe[(classe == 0) & (ndvi >= NDVI_LAVOURA)] = 3                     # Lavoura Temporária
        classe[(classe == 0) & (ndvi >= NDVI_PASTAGEM)] = 4                    # Pastagem
        # NDVI baixo + SWIR alto -> solo seco exposto (B11 separa de sombra/indef.).
        classe[(classe == 0) & (b11 >= SWIR_SOLO_MIN)] = 5                     # Solo Exposto

        classe[~mask_valida] = 0
        return classe

    # ----------------------------------------------------------------- etapa 5
    @staticmethod
    def _vetorizar(classe: np.ndarray, transform, utm_crs):
        """Vetoriza o raster classificado e devolve [(nome_classe, polígono_4326)]."""
        transformer = Transformer.from_crs(utm_crs.pyproj_crs(), "EPSG:4326", always_xy=True)

        def para_wgs(geom):
            return shapely_transform(
                lambda xs, ys, z=None: transformer.transform(xs, ys), geom
            )

        poligonos = []
        for geom_geojson, valor in rasterio.features.shapes(
            classe, mask=classe > 0, transform=transform
        ):
            nome = CLASSE_POR_CODIGO.get(int(valor))
            if not nome:
                continue
            poly = shape(geom_geojson)
            if poly.is_empty:
                continue
            # Simplificação leve em metros (ainda na grade UTM).
            poly = poly.simplify(TOLERANCIA_SIMPLIFICACAO_M, preserve_topology=True)
            if poly.is_empty:
                continue
            poly_wgs = para_wgs(poly)
            if poly_wgs.is_empty:
                continue
            poligonos.append((nome, poly_wgs))
        return poligonos

    # ----------------------------------------------------------------- etapa 6
    def _gravar(self, imoveis_geom, poligonos, db_session: Session) -> int:
        """Recorta os polígonos por imóvel, associa o imovel_id e persiste."""
        arvore = STRtree([g for _, g in poligonos])
        total = 0

        for imovel, geom_imovel in imoveis_geom:
            # Idempotência: remove só a camada Sentinel anterior deste imóvel
            # (não toca na base do MapBiomas, que tem fonte diferente).
            db_session.query(CoberturaObservada).filter(
                CoberturaObservada.imovel_id == imovel.id,
                CoberturaObservada.fonte == self.FONTE,
            ).delete(synchronize_session=False)

            # Recorta a cobertura pelo perímetro do imóvel, agrupando por classe.
            recortes_por_classe: dict[str, list] = {}
            for idx in np.atleast_1d(arvore.query(geom_imovel)):
                nome, poly = poligonos[int(idx)]
                if not poly.intersects(geom_imovel):
                    continue
                recorte = poly.intersection(geom_imovel)
                if recorte.is_empty:
                    continue
                recortes_por_classe.setdefault(nome, []).append(recorte)

            for nome, geoms in recortes_por_classe.items():
                multi = self._para_multipolygon(unary_union(geoms))
                if multi is None or multi.is_empty:
                    continue
                db_session.add(
                    CoberturaObservada(
                        imovel_id=imovel.id,
                        classe=nome,
                        # Área recalculada via ST_Area no diagnóstico (igual ao MapBiomas).
                        area_hectares=0.0,
                        fonte=self.FONTE,
                        geometria=f"SRID=4326;{multi.wkt}",
                    )
                )
                total += 1

            db_session.commit()

        return total

    @staticmethod
    def _para_multipolygon(geom):
        """Normaliza qualquer geometria poligonal resultante para MultiPolygon."""
        if geom is None or geom.is_empty:
            return None
        if isinstance(geom, MultiPolygon):
            return geom
        if isinstance(geom, Polygon):
            return MultiPolygon([geom])
        # GeometryCollection (ex: borda gerando linhas/pontos) — fica só com polígonos.
        polys = [g for g in getattr(geom, "geoms", []) if isinstance(g, Polygon)]
        return MultiPolygon(polys) if polys else None
