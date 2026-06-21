"""
Tupã — API FastAPI principal.

Endpoints:
  POST /ndvi                    → série histórica NDVI por polígono (usado pelo cadastro)
  GET  /imovel/{id}             → dados do imóvel
  GET  /imovel/{id}/diagnostico → diagnóstico completo com divergências e score
  GET  /imovel/{id}/ndvi        → estatísticas NDVI via satélite Copernicus/Sentinel-2
  GET  /imoveis                 → listagem para analista
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

from db.database import get_db, engine, Base
from db.models import Imovel, Divergencia, CoberturaObservada
from engine import calcular_diagnostico_postgis
from copernicus import calcular_estatisticas_ndvi

from pydantic import BaseModel, field_validator, model_validator
from carsearch import buscar_cars

load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


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
    """Lista todos os imóveis da base para a fila do analista."""
    imoveis = db.query(Imovel).all()
    return [
        {
            "id": i.id,
            "nome": i.nome,
            "municipio": i.municipio,
            "uf": i.uf,
            "numero_car": i.numero_car
        }
        for i in imoveis
    ]


@app.get("/imovel/{imovel_id}/diagnostico")
def get_diagnostico(imovel_id: str, db: Session = Depends(get_db)):
    """
    Diagnóstico completo do imóvel executando o motor no banco sob demanda 
    ou retornando resultado pré-computado.
    """
    imovel = db.query(Imovel).filter(Imovel.id == imovel_id).first()
    if not imovel:
        raise HTTPException(status_code=404, detail=f"Imóvel '{imovel_id}' não encontrado")

    # Por segurança, rodamos o diagnóstico (ou pode ser apenas leitura se já pré-computado)
    resultado_motor = calcular_diagnostico_postgis(imovel_id, db)
    
    divergencias = db.query(Divergencia).filter(Divergencia.imovel_id == imovel_id).all()
    
    return {
        "imovel_id": imovel_id,
        "score_conformidade": resultado_motor["score"],
        "divergencias": [
            {
                "id": div.id,
                "tipo": div.tipo,
                "severidade": div.severidade,
                "area_hectares": div.area_hectares,
                "descricao": div.descricao,
                "base_legal": div.base_legal,
                "caminho_retificacao": div.caminho_retificacao
            } for div in divergencias
        ]
    }


@app.get("/imovel/{imovel_id}/ndvi")
def get_ndvi(
    imovel_id: str,
    data_inicial: str,
    data_final: str,
    db: Session = Depends(get_db),
):
    """
    Retorna estatísticas NDVI do imóvel via satélite Copernicus/Sentinel-2.

    Query params:
      data_inicial — ex: 2024-01-01
      data_final   — ex: 2024-03-31
    """
    imovel = db.query(Imovel).filter(Imovel.id == imovel_id).first()
    if not imovel:
        raise HTTPException(status_code=404, detail=f"Imóvel '{imovel_id}' não encontrado")

    if not imovel.poligono_declarado:
        raise HTTPException(status_code=422, detail="Imóvel sem polígono declarado cadastrado")

    try:
        resultado = calcular_estatisticas_ndvi(
            poligono_frontend=imovel.poligono_declarado,
            data_inicial=data_inicial,
            data_final=data_final,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception as exc:
        logger.exception("Erro ao consultar NDVI via Copernicus")
        raise HTTPException(status_code=500, detail=f"Erro interno ao consultar satélite: {exc}")

    return {
        "imovel_id": imovel_id,
        "periodo": {"inicio": data_inicial, "fim": data_final},
        **resultado,
    }

class NdviPoligonoRequest(BaseModel):
    poligono: List[Ponto]
    data_final: str


@app.post("/ndvi")
def ndvi_por_poligono(body: NdviPoligonoRequest):
    """
    Gera série histórica de NDVI mensal (12 meses) para um polígono livre.
    Usado pelo fluxo de cadastro do frontend.
    """
    pontos = [{"lat": p.lat, "lng": p.lng} for p in body.poligono]

    try:
        data_fim = datetime.strptime(body.data_final, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=422, detail="data_final deve estar no formato YYYY-MM-DD")

    resultados_mensais = []
    for i in range(12):
        # Calcula início e fim de cada mês retroativamente
        mes_offset = i
        ano_fim = data_fim.year
        mes_fim_num = data_fim.month - mes_offset
        while mes_fim_num <= 0:
            mes_fim_num += 12
            ano_fim -= 1
        import calendar
        ultimo_dia = calendar.monthrange(ano_fim, mes_fim_num)[1]
        fim = datetime(ano_fim, mes_fim_num, ultimo_dia)
        inicio = datetime(ano_fim, mes_fim_num, 1)

        try:
            stats = calcular_estatisticas_ndvi(
                poligono_frontend=pontos,
                data_inicial=inicio.strftime("%Y-%m-%d"),
                data_final=fim.strftime("%Y-%m-%d"),
            )
            resultados_mensais.append({
                "data": inicio.strftime("%Y-%m-%d"),
                "ndvi": round(stats["ndvi_medio"], 4),
                "ndviMedio": round(stats["ndvi_medio"], 4),
                "granularidade": "monthly",
                "data_inicial": inicio.strftime("%Y-%m-%d"),
                "data_final": fim.strftime("%Y-%m-%d"),
            })
        except Exception as exc:
            logger.warning("NDVI indisponível para %s/%s: %s", mes_fim_num, ano_fim, exc)

    resultados_mensais.reverse()
    return {"mensal": resultados_mensais}


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

