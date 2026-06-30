"""
Tupã — API FastAPI principal.

Endpoints:
  GET  /imovel/{id}             → dados do imóvel
  GET  /imovel/{id}/diagnostico → diagnóstico completo com divergências e score
  GET  /imoveis                 → listagem para analista, ordenada por conformidade
  GET  /imovel/{id}/hidrografia → dados de cursos d'água
  POST /buscar-cars             → busca CAR no banco a partir de um polígono
  GET  /health                  → healthcheck
"""
from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager
from typing import List

import json
import time

import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Depends
from fastapi.responses import Response as RawResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import ORJSONResponse
from shapely.geometry import mapping as shapely_mapping
from shapely.geometry.base import BaseGeometry
from sqlalchemy.orm import Session
from sqlalchemy import text

from db.database import get_db, engine, Base
from db.models import Imovel, NotificacaoRetificacao
from datetime import datetime, timezone
from engine import calcular_diagnostico_postgis
from config.settings import regras

from pydantic import BaseModel, field_validator, model_validator
from carsearch import buscar_cars

load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

MAPBIOMAS_COLORS: dict[str, str] = {
    "Floresta Nativa": "#15803D",
    "Formação Savânica": "#22C55E",
    "Pastagem": "#86EFAC",
    "Lavoura Temporária": "#EAB308",
    "Outras Lavouras": "#F59E0B",
    "Corpos d'Água": "#3B82F6",
    "Infraestrutura Urbana": "#B45309",
}


# ---------------------------------------------------------------------------
# Modelos de entrada / saída para Busca do CAR
# ---------------------------------------------------------------------------

class Ponto(BaseModel):
    lat: float
    lng: float

    @field_validator("lat")
    @classmethod
    def lat_valida(cls, v: float) -> float:
        if not -90 <= v <= 90:
            raise ValueError(f"Latitude inválida: {v}. Deve estar entre -90 e 90.")
        return v

    @field_validator("lng")
    @classmethod
    def lng_valida(cls, v: float) -> float:
        if not -180 <= v <= 180:
            raise ValueError(f"Longitude inválida: {v}. Deve estar entre -180 e 180.")
        return v


class BuscarCarsRequest(BaseModel):
    poligono: List[Ponto]

    @model_validator(mode="after")
    def poligono_minimo(self) -> "BuscarCarsRequest":
        if len(self.poligono) < 3:
            raise ValueError("O polígono precisa ter pelo menos 3 pontos.")
        return self


class BuscarCarsResponse(BaseModel):
    total: int
    cars: List[dict]


# ---------------------------------------------------------------------------
# App Lifespan
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Cria as tabelas se não existirem
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("Tupã API iniciada — Banco PostGIS conectado.")
    except Exception as e:
        logger.warning(f"Não foi possível conectar ao banco PostGIS (PostgreSQL): {e}")
        logger.warning("Os recursos dependentes de banco de dados estarão indisponíveis, mas a API continuará rodando para a busca local de CAR.")
    yield


app = FastAPI(
    title="Tupã API",
    description="Motor de divergências ambientais do CAR via PostGIS.",
    version="2.0.0",
    lifespan=lifespan,
    default_response_class=ORJSONResponse,
)

# CORS — dev + configurável via env
cors_origins_env = os.getenv("CORS_ORIGINS", "")
cors_origins = [o.strip() for o in cors_origins_env.split(",") if o.strip()]
cors_origins.extend(["*"])  # Apenas para dev, restringir em prod

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# In-memory cache  (key → (expires_at, raw_json_bytes))
# ---------------------------------------------------------------------------

_cache: dict[str, tuple[float, bytes]] = {}


def _cached(key: str, ttl: float, builder) -> RawResponse:
    entry = _cache.get(key)
    if entry and time.monotonic() < entry[0]:
        return RawResponse(content=entry[1], media_type="application/json")
    raw: str = builder()
    _cache[key] = (time.monotonic() + ttl, raw.encode())
    return RawResponse(content=raw, media_type="application/json")


# ---------------------------------------------------------------------------
# Endpoints Tupã
# ---------------------------------------------------------------------------

@app.get("/health")
def health(db: Session = Depends(get_db)):
    try:
        count = db.query(Imovel).count()
        return {"status": "ok", "imoveis_no_banco": count}
    except Exception as e:
        return {"status": "erro", "detalhe": str(e)}


@app.get("/imovel/{imovel_id}")
def get_imovel(imovel_id: str, db: Session = Depends(get_db)):
    """Retorna dados base do imóvel cadastrado no PostGIS."""
    row = db.execute(
        text("""
            SELECT id, nome, municipio, uf, numero_car,
                   ST_AsGeoJSON(poligono_declarado) AS poligono_geojson
            FROM imovel WHERE id = :iid
        """),
        {"iid": imovel_id},
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail=f"Imóvel '{imovel_id}' não encontrado")

    return {
        "id": row.id,
        "nome": row.nome,
        "municipio": row.municipio,
        "uf": row.uf,
        "numero_car": row.numero_car,
        "poligono_declarado": json.loads(row.poligono_geojson) if row.poligono_geojson else None,
    }


@app.get("/imoveis")
def list_imoveis(db: Session = Depends(get_db)):
    """Lista imóveis — JSON montado pelo Postgres via json_agg (zero serialização Python)."""
    def build():
        return db.execute(
            text("""
                WITH scored AS (
                    SELECT d.imovel_id,
                           GREATEST(0, 100 - SUM(
                               CASE d.severidade WHEN 'alta' THEN 15 WHEN 'media' THEN 8 ELSE 3 END
                           )) AS score,
                           COUNT(*) AS n_div,
                           CASE
                               WHEN BOOL_OR(d.severidade = 'alta')  THEN 'alta'
                               WHEN BOOL_OR(d.severidade = 'media') THEN 'media'
                               WHEN COUNT(*) > 0                    THEN 'baixa'
                               ELSE NULL
                           END AS max_sev
                    FROM divergencia d
                    GROUP BY d.imovel_id
                )
                SELECT COALESCE(
                    json_agg(
                        json_build_object(
                            'id',            i.id,
                            'nome',          i.nome,
                            'municipio',     i.municipio,
                            'uf',            i.uf,
                            'numero_car',    i.numero_car,
                            'score',         ROUND(COALESCE(s.score, 100)::numeric, 1),
                            'n_divergencias', COALESCE(s.n_div, 0),
                            'max_severidade', s.max_sev
                        )
                        ORDER BY COALESCE(s.score, 100) ASC
                    )::text,
                    '[]'
                ) AS json
                FROM imovel i
                LEFT JOIN scored s ON s.imovel_id = i.id
            """)
        ).scalar()
    return _cached("imoveis", 300.0, build)


@app.get("/imovel/{imovel_id}/diagnostico")
def get_diagnostico(imovel_id: str, recalcular: bool = False, db: Session = Depends(get_db)):
    """
    Diagnóstico completo. Usa dados pré-computados por padrão;
    passe ?recalcular=true para forçar re-execução do motor.
    """
    imovel = db.query(Imovel).filter(Imovel.id == imovel_id).first()
    if not imovel:
        raise HTTPException(status_code=404, detail=f"Imóvel '{imovel_id}' não encontrado")

    tem_divs = db.execute(
        text("SELECT COUNT(*) FROM divergencia WHERE imovel_id = :iid"),
        {"iid": imovel_id},
    ).scalar() or 0

    if recalcular or tem_divs == 0:
        calcular_diagnostico_postgis(imovel_id, db)

    score = db.execute(
        text("""
            SELECT GREATEST(0, 100 - COALESCE(SUM(
                CASE severidade WHEN 'alta' THEN 15 WHEN 'media' THEN 8 ELSE 3 END
            ), 0)) FROM divergencia WHERE imovel_id = :iid
        """),
        {"iid": imovel_id},
    ).scalar() or 100.0

    resultado_motor = {"score": float(score)}

    # ── Divergências com geometria ────────────────────────────────────────────
    divs_rows = db.execute(
        text("""
            SELECT id, tipo, severidade, area_hectares, descricao, base_legal,
                   caminho_retificacao, ST_AsGeoJSON(geometria) AS geojson
            FROM divergencia WHERE imovel_id = :iid
        """),
        {"iid": imovel_id},
    ).fetchall()

    divergencias_out = [
        {
            "id": r.id,
            "tipo": r.tipo,
            "severidade": r.severidade,
            "area_hectares": r.area_hectares,
            "descricao": r.descricao,
            "base_legal": r.base_legal,
            "caminho_retificacao": r.caminho_retificacao,
            "texto_linguagem_simples": r.descricao,
            "poligono_divergencia": json.loads(r.geojson) if r.geojson else None,
        }
        for r in divs_rows
    ]

    # ── Cobertura do solo (percentual por classe) ─────────────────────────────
    cob_rows = db.execute(
        text("""
            SELECT classe,
                   ST_Area(ST_Transform(ST_Union(geometria), 5880)) / 10000.0 AS area_ha
            FROM cobertura_observada
            WHERE imovel_id = :iid
            GROUP BY classe
        """),
        {"iid": imovel_id},
    ).fetchall()

    total_area = sum(float(r.area_ha or 0) for r in cob_rows) or 1.0
    cobertura_solo = [
        {
            "classe": r.classe,
            "percentual": round(float(r.area_ha or 0) / total_area * 100, 1),
            "cor_hex": next(
                (v for k, v in MAPBIOMAS_COLORS.items() if k in r.classe), "#888888"
            ),
        }
        for r in cob_rows
    ]

    # ── Camadas geométricas para o mapa ──────────────────────────────────────
    poligono_row = db.execute(
        text("SELECT ST_AsGeoJSON(poligono_declarado) FROM imovel WHERE id = :iid"),
        {"iid": imovel_id},
    ).scalar()
    poligono_geojson = json.loads(poligono_row) if poligono_row else None

    app_row = db.execute(
        text("""
            SELECT ST_AsGeoJSON(
                ST_Union(ST_Buffer(h.geometria::geography, 30)::geometry)
            )
            FROM hidrografia h
            JOIN imovel i ON i.id = :iid
            WHERE ST_Intersects(h.geometria, i.poligono_declarado)
              AND h.municipio = i.municipio
        """),
        {"iid": imovel_id},
    ).scalar()
    app_geojson = json.loads(app_row) if app_row else None

    cob_poly_rows = db.execute(
        text("""
            SELECT classe, ST_AsGeoJSON(geometria) AS geojson
            FROM cobertura_observada
            WHERE imovel_id = :iid
        """),
        {"iid": imovel_id},
    ).fetchall()
    cobertura_poligonos = [
        {
            "classe": r.classe,
            "cor_hex": next(
                (v for k, v in MAPBIOMAS_COLORS.items() if k in r.classe), "#888888"
            ),
            "geometry": json.loads(r.geojson),
        }
        for r in cob_poly_rows
        if r.geojson
    ]

    return {
        "imovel_id": imovel_id,
        "score_conformidade": resultado_motor["score"],
        "cobertura_solo": cobertura_solo,
        "divergencias": divergencias_out,
        "camadas": {
            "poligono_declarado": poligono_geojson,
            "app": app_geojson,
            "divergencias": divergencias_out,
            "cobertura_poligonos": cobertura_poligonos,
        },
    }





def _faixa_app(largura_m: float | None) -> int:
    if largura_m is None:
        return 30
    for faixa in sorted(regras.app.cursos_dagua.faixas, key=lambda x: x.largura_max):
        if largura_m <= faixa.largura_max:
            return faixa.distancia_app
    return 500


@app.get("/imovel/{imovel_id}/hidrografia")
def get_hidrografia(imovel_id: str, db: Session = Depends(get_db)):
    """
    Retorna os cursos d'água que interceptam o polígono do imóvel,
    com comprimento interno e faixa de APP exigida pelo Código Florestal.
    """
    imovel = db.query(Imovel).filter(Imovel.id == imovel_id).first()
    if not imovel:
        raise HTTPException(status_code=404, detail=f"Imóvel '{imovel_id}' não encontrado")

    rows = db.execute(
        text("""
            SELECT
                h.id,
                h.tipo,
                h.largura,
                ROUND(
                    ST_Length(
                        ST_Intersection(h.geometria, i.poligono_declarado)::geography
                    )::numeric, 1
                ) AS comprimento_interno_m,
                ROUND(ST_Length(h.geometria::geography)::numeric, 1) AS comprimento_total_m
            FROM hidrografia h
            JOIN imovel i ON i.id = :imovel_id
            WHERE ST_Intersects(h.geometria, i.poligono_declarado)
              AND h.municipio = i.municipio
        """),
        {"imovel_id": imovel_id},
    ).fetchall()

    cursos = [
        {
            "id": r.id,
            "tipo": r.tipo or "rio",
            "largura_m": r.largura,
            "comprimento_interno_m": float(r.comprimento_interno_m or 0),
            "comprimento_total_m": float(r.comprimento_total_m or 0),
            "faixa_app_m": _faixa_app(r.largura),
        }
        for r in rows
    ]

    return {
        "imovel_id": imovel_id,
        "total_cursos": len(cursos),
        "cursos": cursos,
    }


@app.get("/imovel/{imovel_id}/resumo")
def get_imovel_resumo(imovel_id: str, db: Session = Depends(get_db)):
    """Diagnóstico pré-computado sem re-rodar o motor — ideal para painel do mapa."""
    imovel = db.query(Imovel).filter(Imovel.id == imovel_id).first()
    if not imovel:
        raise HTTPException(status_code=404, detail=f"Imóvel '{imovel_id}' não encontrado")

    divs = db.execute(
        text("""
            SELECT id, tipo, severidade, area_hectares, descricao, base_legal,
                   caminho_retificacao, ST_AsGeoJSON(geometria) AS geojson
            FROM divergencia WHERE imovel_id = :iid
        """),
        {"iid": imovel_id},
    ).fetchall()

    score = max(0.0, 100.0 - sum(
        15 if d.severidade == "alta" else 8 if d.severidade == "media" else 3
        for d in divs
    ))

    cob_rows = db.execute(
        text("""
            SELECT classe,
                   ST_Area(ST_Transform(ST_Union(geometria), 5880)) / 10000.0 AS area_ha
            FROM cobertura_observada WHERE imovel_id = :iid GROUP BY classe
        """),
        {"iid": imovel_id},
    ).fetchall()

    total_ha = sum(float(r.area_ha or 0) for r in cob_rows) or 1.0

    return {
        "imovel_id": imovel_id,
        "nome": imovel.nome,
        "numero_car": imovel.numero_car,
        "score_conformidade": round(score, 1),
        "divergencias": [
            {
                "id": d.id,
                "tipo": d.tipo,
                "severidade": d.severidade,
                "area_hectares": d.area_hectares,
                "texto_linguagem_simples": d.descricao,
                "base_legal": d.base_legal,
                "caminho_retificacao": d.caminho_retificacao,
                "poligono_divergencia": json.loads(d.geojson) if d.geojson else None,
            }
            for d in divs
        ],
        "cobertura_solo": [
            {
                "classe": r.classe,
                "percentual": round(float(r.area_ha or 0) / total_ha * 100, 1),
                "cor_hex": next((v for k, v in MAPBIOMAS_COLORS.items() if k in r.classe), "#888888"),
            }
            for r in cob_rows
        ],
    }


@app.get("/imovel/{imovel_id}/enquadramento_rl")
def get_enquadramento_rl(imovel_id: str, db: Session = Depends(get_db)):
    """Calcula e retorna o enquadramento de Reserva Legal para um imóvel."""
    from gerar_base_referencia import calcular_enquadramento_rl, _modulo_fiscal, _percentual_rl
    imovel = db.query(Imovel).filter(Imovel.id == imovel_id).first()
    if not imovel:
        raise HTTPException(status_code=404, detail=f"Imóvel '{imovel_id}' não encontrado")
    mf = _modulo_fiscal(imovel.municipio)
    enq = calcular_enquadramento_rl(imovel_id, db, modulo_fiscal_ha=mf)
    if not enq:
        raise HTTPException(status_code=404, detail="Não foi possível calcular o enquadramento")
    perc = _percentual_rl(imovel.uf or "MG")
    return {
        "imovel_id": imovel_id,
        "bioma": "Cerrado",
        "percentual_aplicavel": perc,
        "art68_pendente": False,
        **enq,
    }


@app.get("/municipios/cobertura")
def get_municipios_cobertura(db: Session = Depends(get_db)):
    """Lista municípios com contagem de imóveis e indicador de base gerada."""
    rows = db.execute(text("""
        SELECT
            i.municipio,
            COALESCE(i.uf, 'MG') AS uf,
            COUNT(DISTINCT i.id) AS total_imoveis,
            COUNT(DISTINCT f.imovel_id) > 0 AS tem_base_referencia
        FROM imovel i
        LEFT JOIN feicao_referencia f ON f.municipio = i.municipio
        GROUP BY i.municipio, i.uf
        ORDER BY i.municipio
    """)).fetchall()
    return [
        {
            "municipio": r.municipio,
            "uf": r.uf,
            "tem_base_referencia": bool(r.tem_base_referencia),
            "total_imoveis": int(r.total_imoveis),
            "imoveis_impactados": 0,
            "ha_sem_cobertura": 0.0,
        }
        for r in rows
    ]


@app.get("/municipio/{municipio}/stats")
def get_municipio_stats(municipio: str, db: Session = Depends(get_db)):
    """Estatísticas agregadas do município para o painel de resumo."""
    row = db.execute(
        text("""
            WITH scored AS (
                SELECT i.id,
                       GREATEST(0, 100 - COALESCE(
                           SUM(CASE d.severidade WHEN 'alta' THEN 15 WHEN 'media' THEN 8 ELSE 3 END), 0
                       )) AS score
                FROM imovel i
                LEFT JOIN divergencia d ON d.imovel_id = i.id
                WHERE i.municipio = :mun
                GROUP BY i.id
            )
            SELECT COUNT(*) AS total,
                   ROUND(AVG(score)::numeric, 1) AS media_score,
                   ROUND(100.0 * SUM(CASE WHEN score >= 90 THEN 1 ELSE 0 END)::numeric
                         / NULLIF(COUNT(*), 0), 1) AS perc_conf
            FROM scored
        """),
        {"mun": municipio},
    ).fetchone()

    cam = {
        r.tipo: float(r.ha or 0)
        for r in db.execute(
            text("SELECT tipo, ROUND(SUM(area_hectares)::numeric,1) AS ha FROM feicao_referencia WHERE municipio=:mun GROUP BY tipo"),
            {"mun": municipio},
        ).fetchall()
    }

    return {
        "municipio": municipio,
        "total_imoveis": int(row.total or 0),
        "media_score": float(row.media_score or 0),
        "perc_conformidade": float(row.perc_conf or 0),
        "total_app_ha": cam.get("APP_CURSO_DAGUA", 0),
        "total_rl_ha": cam.get("RESERVA_LEGAL_PROPOSTA", 0),
        "total_uso_restrito_ha": cam.get("USO_RESTRITO_ENCOSTA", 0),
    }


@app.get("/municipio/{municipio}/mapa")
def get_municipio_mapa(municipio: str, db: Session = Depends(get_db)):
    """GeoJSON FeatureCollection — JSON montado inteiramente pelo Postgres."""
    def build():
        return db.execute(
            text("""
                WITH scored AS (
                    SELECT d.imovel_id,
                           GREATEST(0, 100 - SUM(
                               CASE d.severidade WHEN 'alta' THEN 15 WHEN 'media' THEN 8 ELSE 3 END
                           )) AS score,
                           COUNT(*) AS n_div
                    FROM divergencia d
                    GROUP BY d.imovel_id
                )
                SELECT json_build_object(
                    'type', 'FeatureCollection',
                    'features', COALESCE(
                        json_agg(
                            json_build_object(
                                'type', 'Feature',
                                'geometry', ST_AsGeoJSON(
                                    ST_SimplifyPreserveTopology(i.poligono_declarado::geometry, 0.0001)
                                )::json,
                                'properties', json_build_object(
                                    'id',            i.id,
                                    'nome',          i.nome,
                                    'numero_car',    i.numero_car,
                                    'score',         ROUND(COALESCE(s.score, 100)::numeric, 1),
                                    'n_divergencias', COALESCE(s.n_div, 0)
                                )
                            )
                        ),
                        '[]'::json
                    )
                )::text AS json
                FROM imovel i
                LEFT JOIN scored s ON s.imovel_id = i.id
                WHERE i.municipio = :mun
                  AND i.poligono_declarado IS NOT NULL
            """),
            {"mun": municipio},
        ).scalar()
    return _cached(f"mapa:{municipio}", 3600.0, build)


_TIPOS_VALIDOS = {"APP_CURSO_DAGUA", "APP_NASCENTE", "APP_LAGO", "APP_VEREDA",
                  "USO_RESTRITO_ENCOSTA", "RESERVA_LEGAL_PROPOSTA", "COBERTURA"}


@app.get("/municipio/{municipio}/camadas/{tipo}")
def get_municipio_camadas(municipio: str, tipo: str, db: Session = Depends(get_db)):
    """GeoJSON FeatureCollection de feicao_referencia — montado pelo Postgres."""
    if tipo not in _TIPOS_VALIDOS:
        raise HTTPException(status_code=400, detail=f"Tipo inválido: {tipo}")

    def build():
        return db.execute(
            text("""
                SELECT json_build_object(
                    'type', 'FeatureCollection',
                    'features', COALESCE(
                        json_agg(
                            json_build_object(
                                'type', 'Feature',
                                'geometry', ST_AsGeoJSON(geometria)::json,
                                'properties', json_build_object(
                                    'id',            id,
                                    'imovel_id',     imovel_id,
                                    'subclasse',     subclasse,
                                    'base_legal',    base_legal,
                                    'area_hectares', area_hectares,
                                    'confianca',     confianca
                                )
                            )
                        ),
                        '[]'::json
                    )
                )::text AS json
                FROM feicao_referencia
                WHERE municipio = :mun AND tipo = :tipo AND geometria IS NOT NULL
            """),
            {"mun": municipio, "tipo": tipo},
        ).scalar()
    return _cached(f"camadas:{municipio}:{tipo}", 3600.0, build)


@app.post("/admin/invalidar-cache")
def invalidar_cache():
    """Limpa o cache em memória — chamar após re-execução do pipeline."""
    _cache.clear()
    return {"ok": True, "mensagem": "Cache invalidado."}


@app.post("/imovel/processar/{cod_imovel}")
def processar_car(cod_imovel: str, db: Session = Depends(get_db)):
    """
    Processa um CAR sob demanda: extrai polígono, carrega fontes, roda motor de
    divergências e gera base de referência (feicao_referencia).
    """
    from pathlib import Path as _Path
    import geopandas as gpd
    from shapely.geometry import MultiPolygon
    from gerar_base_referencia import gerar_base_municipio, gerar_base_imovel

    imovel_id = f"imovel_{cod_imovel}"

    existente = db.query(Imovel).filter(Imovel.id == imovel_id).first()
    if existente:
        municipio = existente.municipio
    else:
        gpkg = _Path(__file__).resolve().parent / "data" / "minas_gerais" / "declarado.gpkg"
        if not gpkg.exists():
            raise HTTPException(status_code=404, detail="declarado.gpkg de MG não encontrado.")

        gdf = gpd.read_file(gpkg, where=f"cod_imovel = '{cod_imovel}'")
        if gdf.empty:
            raise HTTPException(status_code=404, detail=f"CAR não encontrado: {cod_imovel}")

        if gdf.crs and gdf.crs.to_epsg() != 4326:
            gdf = gdf.to_crs("EPSG:4326")

        row = gdf.iloc[0]
        geom = row.geometry
        if geom and geom.geom_type == "Polygon":
            geom = MultiPolygon([geom])

        municipio = str(row.get("municipio") or "Minas Gerais")
        db.add(Imovel(
            id=imovel_id,
            nome=cod_imovel,
            municipio=municipio,
            uf="MG",
            numero_car=cod_imovel,
            poligono_declarado=f"SRID=4326;{geom.wkt}" if geom else None,
        ))
        db.commit()
        logger.info(f"CAR inserido: {cod_imovel} ({municipio})")

    # Carrega fontes apenas quando ausentes — evita re-ler arquivos grandes a cada clique.
    # Para forçar recarga completa, DELETE as linhas do município nas tabelas e reprocesse.
    from sources.mapbiomas import MapBiomasSourceAdapter
    from sources.hidrografia import HidrografiaSourceAdapter
    from sources.elevacao import ElevacaoSourceAdapter

    hidro_count = db.execute(
        text("SELECT COUNT(*) FROM hidrografia WHERE municipio = :m"), {"m": municipio}
    ).scalar() or 0
    if hidro_count == 0:
        logger.info(f"Hidrografia ausente para {municipio} — extraindo…")
        HidrografiaSourceAdapter().load_data(municipio, db)
    else:
        logger.info(f"Hidrografia já presente para {municipio} ({hidro_count} feições) — pulando.")

    cob_count = db.execute(
        text("SELECT COUNT(*) FROM cobertura_observada WHERE imovel_id = :iid"), {"iid": imovel_id}
    ).scalar() or 0
    if cob_count == 0:
        logger.info(f"Cobertura ausente para {imovel_id} — carregando MapBiomas + Elevação…")
        MapBiomasSourceAdapter().load_data(municipio, db)
        ElevacaoSourceAdapter().load_data(municipio, db)
    else:
        logger.info(f"Cobertura já presente para {imovel_id} ({cob_count} polígonos) — pulando.")

    # (Re)calcula divergências
    calcular_diagnostico_postgis(imovel_id, db)

    # Gera/atualiza feições de referência apenas para este imóvel
    gerar_base_imovel(imovel_id, municipio, db)

    _cache.pop("imoveis", None)
    return {"ok": True, "imovel_id": imovel_id}


@app.post("/buscar-cars", response_model=BuscarCarsResponse)
def buscar_cars_endpoint(body: BuscarCarsRequest):
    """
    Recebe uma lista de pontos (lat/lng) formando um polígono e retorna
    todos os registros do CAR que intersectam essa área.
    """
    pontos_dict = [{"lat": p.lat, "lng": p.lng} for p in body.poligono]

    try:
        resultado = buscar_cars(pontos_dict)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Erro ao buscar imóveis do CAR")
        raise HTTPException(status_code=500, detail=f"Erro interno: {exc}") from exc

    cars_serializados = []
    for record in resultado:
        row = {}
        for k, v in record.items():
            if isinstance(v, BaseGeometry):
                row[k] = shapely_mapping(v)
            else:
                try:
                    json.dumps(v)
                    row[k] = v
                except (TypeError, ValueError):
                    row[k] = str(v)
        cars_serializados.append(row)

    return BuscarCarsResponse(total=len(cars_serializados), cars=cars_serializados)


# ---------------------------------------------------------------------------
# Notificações de Retificação (analista → agricultor)
# ---------------------------------------------------------------------------

class NotificacaoInput(BaseModel):
    car: str
    mensagem: str
    tipo: str = "pendencia"      # pendencia | aprovado | reprovado | info
    prioridade: str = "media"    # alta | media | baixa
    analista_nome: str


@app.post("/notificacao/")
def criar_notificacao(body: NotificacaoInput, db: Session = Depends(get_db)):
    """Analista envia notificação ao agricultor sobre o CAR."""
    notif = NotificacaoRetificacao(
        car=body.car,
        mensagem=body.mensagem,
        tipo=body.tipo,
        prioridade=body.prioridade,
        analista_nome=body.analista_nome,
        status="nova",
        criado_em=datetime.now(timezone.utc).isoformat(),
    )
    db.add(notif)
    db.commit()
    db.refresh(notif)
    return {"ok": True, "id": notif.id}


@app.get("/notificacao/{car}")
def listar_notificacoes(car: str, db: Session = Depends(get_db)):
    """Agricultor consulta notificações enviadas pelo analista para seu CAR."""
    rows = (
        db.query(NotificacaoRetificacao)
        .filter(NotificacaoRetificacao.car == car)
        .order_by(NotificacaoRetificacao.id.desc())
        .all()
    )
    return [
        {
            "id": n.id,
            "mensagem": n.mensagem,
            "tipo": n.tipo,
            "prioridade": n.prioridade,
            "analista_nome": n.analista_nome,
            "status": n.status,
            "criado_em": n.criado_em,
            "visualizado_em": n.visualizado_em,
        }
        for n in rows
    ]


@app.patch("/notificacao/{notif_id}/visualizar")
def marcar_visualizada(notif_id: int, db: Session = Depends(get_db)):
    """Agricultor marca notificação como visualizada."""
    notif = db.query(NotificacaoRetificacao).filter(NotificacaoRetificacao.id == notif_id).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notificação não encontrada")
    notif.status = "visualizada"
    notif.visualizado_em = datetime.now(timezone.utc).isoformat()
    db.commit()
    return {"ok": True}


@app.get("/notificacao/")
def listar_todas_notificacoes(db: Session = Depends(get_db)):
    """Analista vê todas as notificações enviadas."""
    rows = (
        db.query(NotificacaoRetificacao)
        .order_by(NotificacaoRetificacao.id.desc())
        .limit(200)
        .all()
    )
    return [
        {
            "id": n.id,
            "car": n.car,
            "mensagem": n.mensagem,
            "tipo": n.tipo,
            "prioridade": n.prioridade,
            "analista_nome": n.analista_nome,
            "status": n.status,
            "criado_em": n.criado_em,
        }
        for n in rows
    ]


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

