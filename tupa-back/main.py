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
from datetime import datetime, timedelta
from typing import List

import json

import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from shapely.geometry import mapping as shapely_mapping
from shapely.geometry.base import BaseGeometry
from sqlalchemy.orm import Session
from sqlalchemy import text

from db.database import get_db, engine, Base, ensure_schema_upgrades
from db.models import Imovel
from engine import calcular_diagnostico_postgis, calcular_score_conformidade
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
async def lifespan(app: FastAPI):
    # Cria as tabelas se não existirem
    try:
        Base.metadata.create_all(bind=engine)
        ensure_schema_upgrades()
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
    imovel = db.query(Imovel).filter(Imovel.id == imovel_id).first()
    if not imovel:
        raise HTTPException(status_code=404, detail=f"Imóvel '{imovel_id}' não encontrado")

    return {
        "id": imovel.id,
        "nome": imovel.nome,
        "municipio": imovel.municipio,
        "uf": imovel.uf,
        "numero_car": imovel.numero_car
    }


@app.get("/imoveis")
def list_imoveis(db: Session = Depends(get_db)):
    """Lista todos os imóveis da base para a fila do analista, priorizando os com pior score."""
    imoveis = db.query(Imovel).all()
    resultado = []
    for i in imoveis:
        # Calcula/obtém o score atual do imóvel
        score = calcular_score_conformidade(i.id, db)
        resultado.append({
            "id": i.id,
            "nome": i.nome,
            "municipio": i.municipio,
            "uf": i.uf,
            "numero_car": i.numero_car,
            "score": score
        })
    
    # Ordena do pior score (mais baixo) para o melhor
    resultado.sort(key=lambda x: x["score"])
    return resultado


@app.get("/imovel/{imovel_id}/diagnostico")
def get_diagnostico(imovel_id: str, db: Session = Depends(get_db)):
    """
    Diagnóstico completo do imóvel executando o motor no banco sob demanda 
    ou retornando resultado pré-computado.
    """
    imovel = db.query(Imovel).filter(Imovel.id == imovel_id).first()
    if not imovel:
        raise HTTPException(status_code=404, detail=f"Imóvel '{imovel_id}' não encontrado")

    resultado_motor = calcular_diagnostico_postgis(imovel_id, db)

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


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

