"""
Tupã — Gerador de Base de Referência SICAR-ready.

Materializa as feições de referência (APP, Uso Restrito, Reserva Legal, Cobertura)
como camada vetorizada exportável em padrão OGC. Estas feições são o produto
principal do sistema: uma base SICAR-ready para municípios sem base de referência.

Uso:
    python gerar_base_referencia.py <municipio>

Ou importe e chame `gerar_base_municipio(municipio, db)` diretamente.
"""
import sys
import logging
from pathlib import Path
from sqlalchemy.orm import Session
from sqlalchemy import text

sys.path.append(str(Path(__file__).resolve().parent))

from config.settings import regras
from db.models import FeicaoReferencia

logger = logging.getLogger(__name__)

SRID_AREA = 5880  # Polycônica, para cálculo de área no Brasil


# ---------------------------------------------------------------------------
# Helper: expressão CASE para buffer de APP de cursos d'água
# ---------------------------------------------------------------------------

def _case_buffer() -> str:
    faixas = sorted(regras.app.cursos_dagua.faixas, key=lambda x: x.largura_max)
    linhas = [
        f"WHEN COALESCE(h.largura, 0) <= {f.largura_max} THEN {f.distancia_app}"
        for f in faixas
    ]
    return f"(CASE {' '.join(linhas)} ELSE 30 END)"


# ---------------------------------------------------------------------------
# APP de Cursos d'Água (Art. 4, I)
# ---------------------------------------------------------------------------

def gerar_app_cursos(municipio: str, db: Session) -> int:
    buf = _case_buffer()
    result = db.execute(text(f"""
        INSERT INTO feicao_referencia
            (municipio, imovel_id, tipo, subclasse, base_legal, area_hectares, confianca, geometria)
        SELECT
            i.municipio,
            i.id,
            'APP_CURSO_DAGUA',
            'faixa_' || {buf} || 'm',
            'Art. 4, I, Lei 12.651/2012',
            ST_Area(ST_Transform(
                ST_Intersection(
                    ST_Buffer(h.geometria::geography, {buf})::geometry,
                    i.poligono_declarado),
                {SRID_AREA})) / 10000.0,
            CASE WHEN h.largura IS NULL THEN 'baixa' ELSE 'alta' END,
            ST_Multi(ST_Intersection(
                ST_Buffer(h.geometria::geography, {buf})::geometry,
                i.poligono_declarado))
        FROM imovel i
        JOIN hidrografia h ON ST_Intersects(
            ST_Buffer(h.geometria::geography, {buf})::geometry, i.poligono_declarado)
        WHERE i.municipio = :m
          AND h.municipio = i.municipio
          AND h.tipo = 'rio'
          AND ST_Area(ST_Transform(
              ST_Intersection(
                  ST_Buffer(h.geometria::geography, {buf})::geometry,
                  i.poligono_declarado),
              {SRID_AREA})) / 10000.0 > 0.001;
    """), {"m": municipio})
    db.commit()
    count = result.rowcount if result.rowcount >= 0 else 0
    logger.info(f"APP_CURSO_DAGUA: {count} feições geradas para {municipio}.")
    return count


# ---------------------------------------------------------------------------
# APP de Nascentes (Art. 4, IV) — buffer de 50m em pontos de nascente
# ---------------------------------------------------------------------------

def gerar_app_nascentes(municipio: str, db: Session) -> int:
    raio = regras.app.nascentes.raio_app
    result = db.execute(text(f"""
        INSERT INTO feicao_referencia
            (municipio, imovel_id, tipo, subclasse, base_legal, area_hectares, confianca, geometria)
        SELECT
            i.municipio,
            i.id,
            'APP_NASCENTE',
            'raio_{raio}m',
            'Art. 4, IV, Lei 12.651/2012',
            ST_Area(ST_Transform(
                ST_Intersection(
                    ST_Buffer(h.geometria::geography, {raio})::geometry,
                    i.poligono_declarado),
                {SRID_AREA})) / 10000.0,
            'alta',
            ST_Multi(ST_Intersection(
                ST_Buffer(h.geometria::geography, {raio})::geometry,
                i.poligono_declarado))
        FROM imovel i
        JOIN hidrografia h ON ST_Intersects(
            ST_Buffer(h.geometria::geography, {raio})::geometry, i.poligono_declarado)
        WHERE i.municipio = :m
          AND h.municipio = i.municipio
          AND h.tipo = 'nascente';
    """), {"m": municipio})
    db.commit()
    count = result.rowcount if result.rowcount >= 0 else 0
    logger.info(f"APP_NASCENTE: {count} feições geradas para {municipio}.")
    return count


# ---------------------------------------------------------------------------
# APP de Lagos e Lagoas Naturais (Art. 4, II)
# ---------------------------------------------------------------------------

def gerar_app_lagos(municipio: str, db: Session) -> int:
    cfg = regras.app.lagos_lagoas_naturais
    # Buffer padrão para zonas rurais; usa faixa reduzida se área do lago ≤ 20ha
    result = db.execute(text(f"""
        INSERT INTO feicao_referencia
            (municipio, imovel_id, tipo, subclasse, base_legal, area_hectares, confianca, geometria)
        SELECT
            i.municipio,
            i.id,
            'APP_LAGO',
            CASE
                WHEN ST_Area(ST_Transform(h.geometria, {SRID_AREA})) / 10000.0 <= {cfg.limiar_area_reduzida_ha}
                     THEN 'faixa_{int(cfg.rural_ate_20ha)}m'
                ELSE 'faixa_{int(cfg.rural_padrao)}m'
            END,
            'Art. 4, II, Lei 12.651/2012',
            ST_Area(ST_Transform(
                ST_Intersection(
                    ST_Buffer(h.geometria::geography,
                        CASE
                            WHEN ST_Area(ST_Transform(h.geometria, {SRID_AREA})) / 10000.0
                                 <= {cfg.limiar_area_reduzida_ha}
                            THEN {cfg.rural_ate_20ha}
                            ELSE {cfg.rural_padrao}
                        END)::geometry,
                    i.poligono_declarado),
                {SRID_AREA})) / 10000.0,
            'media',
            ST_Multi(ST_Intersection(
                ST_Buffer(h.geometria::geography,
                    CASE
                        WHEN ST_Area(ST_Transform(h.geometria, {SRID_AREA})) / 10000.0
                             <= {cfg.limiar_area_reduzida_ha}
                        THEN {cfg.rural_ate_20ha}
                        ELSE {cfg.rural_padrao}
                    END)::geometry,
                i.poligono_declarado))
        FROM imovel i
        JOIN hidrografia h ON ST_Intersects(h.geometria, i.poligono_declarado)
        WHERE i.municipio = :m
          AND h.municipio = i.municipio
          AND h.tipo = 'lago'
          AND ST_Area(ST_Transform(h.geometria, {SRID_AREA})) / 10000.0 > {cfg.dispensa_inferior_ha};
    """), {"m": municipio})
    db.commit()
    count = result.rowcount if result.rowcount >= 0 else 0
    logger.info(f"APP_LAGO: {count} feições geradas para {municipio}.")
    return count


# ---------------------------------------------------------------------------
# APP de Veredas (Art. 4, XI) — faixa de 50m
# ---------------------------------------------------------------------------

def gerar_app_veredas(municipio: str, db: Session) -> int:
    faixa = regras.app.veredas.faixa_marginal
    result = db.execute(text(f"""
        INSERT INTO feicao_referencia
            (municipio, imovel_id, tipo, subclasse, base_legal, area_hectares, confianca, geometria)
        SELECT
            i.municipio,
            i.id,
            'APP_VEREDA',
            'faixa_{int(faixa)}m',
            'Art. 4, XI, Lei 12.651/2012',
            ST_Area(ST_Transform(
                ST_Intersection(
                    ST_Buffer(h.geometria::geography, {faixa})::geometry,
                    i.poligono_declarado),
                {SRID_AREA})) / 10000.0,
            'media',
            ST_Multi(ST_Intersection(
                ST_Buffer(h.geometria::geography, {faixa})::geometry,
                i.poligono_declarado))
        FROM imovel i
        JOIN hidrografia h ON ST_Intersects(
            ST_Buffer(h.geometria::geography, {faixa})::geometry, i.poligono_declarado)
        WHERE i.municipio = :m
          AND h.municipio = i.municipio
          AND h.tipo = 'vereda';
    """), {"m": municipio})
    db.commit()
    count = result.rowcount if result.rowcount >= 0 else 0
    logger.info(f"APP_VEREDA: {count} feições geradas para {municipio}.")
    return count


# ---------------------------------------------------------------------------
# Uso Restrito de Encosta (Art. 11) — copia de uso_restrito para feicao_referencia
# ---------------------------------------------------------------------------

def gerar_uso_restrito(municipio: str, db: Session) -> int:
    result = db.execute(text(f"""
        INSERT INTO feicao_referencia
            (municipio, imovel_id, tipo, subclasse, base_legal, area_hectares, confianca, geometria)
        SELECT
            u.municipio,
            NULL,
            'USO_RESTRITO_ENCOSTA',
            u.tipo,
            'Art. 11, Lei 12.651/2012',
            ST_Area(ST_Transform(u.geometria, {SRID_AREA})) / 10000.0,
            'media',
            u.geometria
        FROM uso_restrito u
        WHERE u.municipio = :m;
    """), {"m": municipio})
    db.commit()
    count = result.rowcount if result.rowcount >= 0 else 0
    logger.info(f"USO_RESTRITO_ENCOSTA: {count} feições geradas para {municipio}.")
    return count


# ---------------------------------------------------------------------------
# Reserva Legal Proposta (Art. 12 / Art. 67)
# ---------------------------------------------------------------------------

# Mapeamento de UF → percentual de RL (proxy por bioma)
_AMAZONIA_FLORESTA = {"AM", "PA", "AC", "RO", "RR", "AP"}
_AMAZONIA_CERRADO = {"TO", "MA", "MT"}


def _percentual_rl(uf: str) -> float:
    if uf in _AMAZONIA_FLORESTA:
        return 0.80
    if uf in _AMAZONIA_CERRADO:
        return 0.35
    return 0.20


def calcular_enquadramento_rl(imovel_id: str, db: Session,
                               modulo_fiscal_ha: float = 0.0) -> dict:
    """Calcula enquadramento de Reserva Legal para um imóvel.

    Retorna dicionário com enquadramento (Art. 12 ou Art. 67), área exigida,
    déficit e metadados para gravar em feicao_referencia.

    Art. 68 nunca é aplicado automaticamente (exige comprovação documental).
    """
    row = db.execute(
        text("SELECT uf FROM imovel WHERE id = :id"),
        {"id": imovel_id}
    ).fetchone()
    if not row:
        return {}

    uf = row.uf or ""
    perc = _percentual_rl(uf)

    area_liquida = db.execute(text(f"""
        SELECT ST_Area(ST_Transform(poligono_declarado, {SRID_AREA})) / 10000.0
        FROM imovel WHERE id = :id
    """), {"id": imovel_id}).scalar() or 0.0

    veg_nativa = db.execute(text(f"""
        SELECT COALESCE(SUM(
            ST_Area(ST_Transform(
                ST_Intersection(c.geometria, i.poligono_declarado), {SRID_AREA})) / 10000.0), 0)
        FROM cobertura_observada c
        JOIN imovel i ON i.id = c.imovel_id
        WHERE c.imovel_id = :id
          AND c.classe IN ('Floresta Nativa', 'Formação Savânica')
    """), {"id": imovel_id}).scalar() or 0.0

    rl_exigida = area_liquida * perc
    n_modulos = (area_liquida / modulo_fiscal_ha) if modulo_fiscal_ha > 0 else 999

    art67_max = regras.reserva_legal.art_67_modulos_fiscais_max
    if n_modulos <= art67_max and veg_nativa < rl_exigida:
        return {
            "enquadramento": "Art. 67, Lei 12.651/2012",
            "rl_exigida_ha": round(veg_nativa, 2),
            "area_liquida_ha": round(area_liquida, 2),
            "modulos_fiscais": round(n_modulos, 2),
            "deficit_ha": 0.0,
            "confianca": "media",
            "observacao": "RL constituída pela veg. nativa de 22/07/2008; marco a validar.",
        }

    return {
        "enquadramento": "Art. 12, Lei 12.651/2012",
        "rl_exigida_ha": round(rl_exigida, 2),
        "area_liquida_ha": round(area_liquida, 2),
        "modulos_fiscais": round(n_modulos, 2),
        "deficit_ha": round(max(0.0, rl_exigida - veg_nativa), 2),
        "confianca": "alta",
        "observacao": None,
    }


def gerar_reserva_legal(municipio: str, db: Session) -> int:
    """Grava a RL proposta como remanescente de vegetação nativa do imóvel."""
    result = db.execute(text(f"""
        INSERT INTO feicao_referencia
            (municipio, imovel_id, tipo, subclasse, base_legal, area_hectares, confianca, geometria)
        SELECT
            i.municipio,
            i.id,
            'RESERVA_LEGAL_PROPOSTA',
            'vegetacao_nativa_remanescente',
            'Art. 12, Lei 12.651/2012',
            COALESCE(SUM(
                ST_Area(ST_Transform(
                    ST_Intersection(c.geometria, i.poligono_declarado),
                    {SRID_AREA})) / 10000.0), 0),
            'media',
            ST_Multi(ST_Union(ST_Intersection(c.geometria, i.poligono_declarado)))
        FROM imovel i
        JOIN cobertura_observada c ON c.imovel_id = i.id
        WHERE i.municipio = :m
          AND c.classe IN ('Floresta Nativa', 'Formação Savânica')
        GROUP BY i.id, i.municipio, i.poligono_declarado
        HAVING SUM(
            ST_Area(ST_Transform(
                ST_Intersection(c.geometria, i.poligono_declarado),
                {SRID_AREA})) / 10000.0) > 0.01;
    """), {"m": municipio})
    db.commit()
    count = result.rowcount if result.rowcount >= 0 else 0
    logger.info(f"RESERVA_LEGAL_PROPOSTA: {count} feições geradas para {municipio}.")
    return count


# ---------------------------------------------------------------------------
# Orquestrador principal
# ---------------------------------------------------------------------------

def gerar_base_municipio(municipio: str, db: Session) -> dict:
    """Gera todas as feições de referência para o município.

    Limpa feições antigas e recalcula todas as camadas SICAR-ready.
    Retorna resumo com contagens por tipo.
    """
    logger.info(f"Gerando base de referência SICAR-ready para {municipio}...")

    db.execute(
        text("DELETE FROM feicao_referencia WHERE municipio = :m"),
        {"m": municipio}
    )
    db.commit()

    resumo = {
        "APP_CURSO_DAGUA": gerar_app_cursos(municipio, db),
        "APP_NASCENTE": gerar_app_nascentes(municipio, db),
        "APP_LAGO": gerar_app_lagos(municipio, db),
        "APP_VEREDA": gerar_app_veredas(municipio, db),
        "USO_RESTRITO_ENCOSTA": gerar_uso_restrito(municipio, db),
        "RESERVA_LEGAL_PROPOSTA": gerar_reserva_legal(municipio, db),
    }

    total = sum(resumo.values())
    logger.info(f"Base gerada: {total} feições totais para {municipio}. Resumo: {resumo}")
    return resumo


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import sys
    from db.database import SessionLocal, Base, engine
    from db.models import FeicaoReferencia as _FR  # noqa: ensure table exists

    logging.basicConfig(level=logging.INFO)

    if len(sys.argv) < 2:
        print("Uso: python gerar_base_referencia.py <municipio>")
        sys.exit(1)

    municipio = sys.argv[1]
    Base.metadata.create_all(bind=engine)

    with SessionLocal() as db:
        resumo = gerar_base_municipio(municipio, db)
        print("\nResumo de feições geradas:")
        for tipo, count in resumo.items():
            print(f"  {tipo}: {count}")
