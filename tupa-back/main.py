"""
Tupã — API FastAPI principal.

Endpoints:
  GET  /imovel/{id}             → dados do imóvel
  GET  /imovel/{id}/diagnostico → diagnóstico completo com divergências e score
  GET  /imoveis                 → listagem para analista
  GET  /health                  → healthcheck
"""
from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager
from typing import List

import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from db.database import get_db, engine, Base
from db.models import Imovel, Divergencia, CoberturaObservada
from engine import calcular_diagnostico_postgis

load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# App Lifespan
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Cria as tabelas se não existirem
    Base.metadata.create_all(bind=engine)
    logger.info("Tupã API iniciada — Banco PostGIS conectado.")
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


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
