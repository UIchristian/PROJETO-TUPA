"""
Tupã — API FastAPI principal.

Endpoints:
  GET  /imovel/{id}             → dados do imóvel + polígono GeoJSON
  GET  /imovel/{id}/diagnostico → diagnóstico completo com divergências reais
  POST /imovel                  → cria imóvel a partir de polígono GeoJSON
  POST /buscar-cars             → busca CAR por polígono (legado)
  POST /ndvi                    → NDVI semanal via Copernicus (legado)
  GET  /health                  → healthcheck
"""
from __future__ import annotations

import json
import logging
import os
import uuid
from contextlib import asynccontextmanager
from datetime import date, timedelta
from pathlib import Path
from typing import List

import geopandas as gpd
import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, field_validator, model_validator
from shapely.geometry import mapping, shape

from engine import calcular_diagnostico, _area_hectares, _geom_to_geojson
from schemas import (
    CoberturaClasse,
    CoberturaPoligono,
    DiagnosticoResponse,
    DivergenciaResponse,
    GeoJSONGeometry,
    ImovelCreateRequest,
    ImovelResponse,
    LayerGeometriesResponse,
)
from sources.exemplo import (
    ExemploDeclaradoSource,
    ExemploDynamicWorldSource,
    ExemploSnifSource,
)

# ---------------------------------------------------------------------------
# Env & logging
# ---------------------------------------------------------------------------

load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data" / "exemplo"

# ---------------------------------------------------------------------------
# In-memory storage for properties
# ---------------------------------------------------------------------------

_imoveis_store: dict[str, dict] = {}

# Source adapters (pluggable)
_snif = ExemploSnifSource()
_dynamic_world = ExemploDynamicWorldSource()
_declarado = ExemploDeclaradoSource()


def _load_example_imovel():
    """Load the example property from GeoJSON into the in-memory store."""
    imovel_path = DATA_DIR / "imovel.geojson"
    if not imovel_path.exists():
        logger.warning("Arquivo de exemplo não encontrado: %s", imovel_path)
        return

    gdf = gpd.read_file(imovel_path)
    for _, row in gdf.iterrows():
        imovel_id = row.get("id", "fazenda-sol-nascente")
        _imoveis_store[imovel_id] = {
            "id": imovel_id,
            "nome": row.get("nome", "Fazenda Sol Nascente"),
            "municipio": row.get("municipio", "Unaí"),
            "uf": row.get("uf", "MG"),
            "numero_car": row.get("numero_car", "BR-MG-3170107-123456-78"),
            "geometry": row.geometry,
        }
        numero_car = _imoveis_store[imovel_id]['numero_car']
        logger.info(f"CAR identificado: {numero_car}")
        logger.info(f"Polígono identificado: {row.geometry}")

    logger.info("Imóvel de exemplo carregado: %s", list(_imoveis_store.keys()))


# ---------------------------------------------------------------------------
# Legado — modelos do SafraSense (buscar-cars / ndvi)
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


class NdviRequest(BuscarCarsRequest):
    data_final: date | None = None


class NdviResponse(BaseModel):
    class RelatorioSemanal(BaseModel):
        referencia_semana: str
        data_inicial: date
        data_final: date
        ndvi_medio: float | None = None
        erro: str | None = None

    total_semanas: int
    relatorios: List[RelatorioSemanal]


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    _load_example_imovel()
    logger.info("Tupã API pronta — %d imóveis carregados", len(_imoveis_store))
    yield


app = FastAPI(
    title="Tupã API",
    description="Gabarito vivo do CAR — diagnóstico ambiental de imóveis rurais.",
    version="2.0.0",
    lifespan=lifespan,
)

# CORS — dev + configurável via env
cors_origins_env = os.getenv("CORS_ORIGINS", "")
cors_origins = [o.strip() for o in cors_origins_env.split(",") if o.strip()]
cors_origins.extend([
    "http://localhost:5173",
    "http://localhost:3000",
    "http://localhost:4321",
    "http://localhost:8080",
    "http://127.0.0.1:8080",
])

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Novos endpoints — Tupã
# ---------------------------------------------------------------------------

@app.get("/health")
def health():
    return {"status": "ok", "imoveis": len(_imoveis_store)}


@app.get("/imovel/{imovel_id}", response_model=ImovelResponse)
def get_imovel(imovel_id: str):
    """Retorna dados do imóvel e o polígono em GeoJSON."""
    entry = _imoveis_store.get(imovel_id)
    if not entry:
        raise HTTPException(status_code=404, detail=f"Imóvel '{imovel_id}' não encontrado")

    geom = entry["geometry"]
    area = _area_hectares(geom)

    return ImovelResponse(
        id=entry["id"],
        nome=entry["nome"],
        municipio=entry["municipio"],
        uf=entry["uf"],
        area_hectares=area,
        numero_car=entry["numero_car"],
        poligono_declarado=GeoJSONGeometry(**_geom_to_geojson(geom)),
    )


@app.get("/imoveis", response_model=list[ImovelResponse])
def list_imoveis():
    """Lista todos os imóveis cadastrados."""
    result = []
    for entry in _imoveis_store.values():
        geom = entry["geometry"]
        area = _area_hectares(geom)
        result.append(ImovelResponse(
            id=entry["id"],
            nome=entry["nome"],
            municipio=entry["municipio"],
            uf=entry["uf"],
            area_hectares=area,
            numero_car=entry["numero_car"],
            poligono_declarado=GeoJSONGeometry(**_geom_to_geojson(geom)),
        ))
    return result


@app.get("/imovel/{imovel_id}/diagnostico", response_model=DiagnosticoResponse)
def get_diagnostico(imovel_id: str):
    """
    Diagnóstico completo: cobertura por classe, camadas GeoJSON,
    divergências e score de conformidade.
    """
    entry = _imoveis_store.get(imovel_id)
    if not entry:
        raise HTTPException(status_code=404, detail=f"Imóvel '{imovel_id}' não encontrado")

    imovel_geom = entry["geometry"]

    result = calcular_diagnostico(
        imovel_id=imovel_id,
        imovel_geom=imovel_geom,
        snif=_snif,
        dynamic_world=_dynamic_world,
        declarado=_declarado,
    )

    # Convert domain objects to API schemas
    divergencias_resp = []
    for div in result.divergencias:
        divergencias_resp.append(DivergenciaResponse(
            id=div.id,
            tipo=div.tipo.value,
            area_hectares=div.area_hectares,
            severidade=div.severidade.value,
            texto_linguagem_simples=div.descricao,
            base_legal=div.base_legal,
            caminho_retificacao=div.caminho_retificacao,
            poligono_divergencia=GeoJSONGeometry(**_geom_to_geojson(div.geometria)),
        ))

    cobertura_resp = [
        CoberturaClasse(
            classe=c.classe,
            percentual=c.percentual,
            cor_hex=c.cor_hex,
        )
        for c in result.cobertura_solo
    ]

    cobertura_poligonos = [
        CoberturaPoligono(
            classe=c.classe,
            cor_hex=c.cor_hex,
            geometry=GeoJSONGeometry(**_geom_to_geojson(c.geometria)),
        )
        for c in result.cobertura_solo
        if c.geometria is not None and not c.geometria.is_empty
    ]

    # Build layers response
    app_geom = result.gabarito.app
    uso_restrito_geom = result.gabarito.uso_restrito
    declarado_geom = result.poligono_declarado or imovel_geom

    camadas = LayerGeometriesResponse(
        poligono_declarado=GeoJSONGeometry(**_geom_to_geojson(declarado_geom)),
        app=GeoJSONGeometry(**_geom_to_geojson(app_geom)),
        uso_restrito=GeoJSONGeometry(**_geom_to_geojson(uso_restrito_geom)) if uso_restrito_geom else None,
        divergencias=divergencias_resp,
        cobertura_poligonos=cobertura_poligonos,
    )

    return DiagnosticoResponse(
        imovel_id=imovel_id,
        score_conformidade=result.score_conformidade,
        cobertura_solo=cobertura_resp,
        camadas=camadas,
        divergencias=divergencias_resp,
    )


@app.post("/imovel", response_model=ImovelResponse, status_code=201)
def create_imovel(body: ImovelCreateRequest):
    """Cria um novo imóvel a partir de um polígono GeoJSON."""
    geom = shape(body.poligono.model_dump())

    if not geom.is_valid:
        geom = geom.buffer(0)
    if geom.is_empty:
        raise HTTPException(status_code=422, detail="Polígono inválido ou vazio")

    imovel_id = f"imovel-{uuid.uuid4().hex[:8]}"
    area = _area_hectares(geom)

    _imoveis_store[imovel_id] = {
        "id": imovel_id,
        "nome": body.nome,
        "municipio": body.municipio,
        "uf": body.uf,
        "numero_car": body.numero_car,
        "geometry": geom,
    }

    return ImovelResponse(
        id=imovel_id,
        nome=body.nome,
        municipio=body.municipio,
        uf=body.uf,
        area_hectares=area,
        numero_car=body.numero_car,
        poligono_declarado=body.poligono,
    )


# ---------------------------------------------------------------------------
# Endpoints legados (SafraSense) — buscar-cars / ndvi
# ---------------------------------------------------------------------------

@app.post("/buscar-cars", response_model=BuscarCarsResponse)
def buscar_cars_endpoint(body: BuscarCarsRequest):
    """
    Busca registros do CAR que intersectam um polígono.
    Requer shapefile AREA_IMOVEL.shp (legado do SafraSense).
    Se indisponível, retorna um mock do imóvel de exemplo.
    """
    try:
        from carsearch import buscar_cars

        pontos_dict = [{"lat": p.lat, "lng": p.lng} for p in body.poligono]
        try:
            resultado = buscar_cars(pontos_dict)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Erro interno: {exc}") from exc

        cars_serializados = []
        for record in resultado:
            row = {}
            for k, v in record.items():
                try:
                    json.dumps(v)
                    row[k] = v
                except (TypeError, ValueError):
                    row[k] = str(v)
            cars_serializados.append(row)

        return BuscarCarsResponse(total=len(cars_serializados), cars=cars_serializados)

    except (FileNotFoundError, ImportError) as exc:
        logger.warning(
            "Shapefile do CAR indisponível (%s). Retornando dados mockados para desenvolvimento.",
            exc
        )
        # Cria um mock com base no polígono enviado e nos dados da Fazenda Sol Nascente
        coords = [[p.lng, p.lat] for p in body.poligono]
        if coords and coords[0] != coords[-1]:
            coords.append(coords[0])  # fecha o anel do polígono

        mock_car = {
            "codigo_imovel": "BR-MG-3170107-123456-78",
            "cod_imovel": "BR-MG-3170107-123456-78",
            "municipio": "Unaí",
            "uf": "MG",
            "area_ha": 345.0,
            "poligono": coords,
            "geometria": {
                "type": "Polygon",
                "coordinates": [coords]
            }
        }
        return BuscarCarsResponse(total=1, cars=[mock_car])


@app.post("/ndvi", response_model=NdviResponse)
@app.post("/nvdi", response_model=NdviResponse)
def calcular_ndvi_endpoint(body: NdviRequest):
    """Relatórios semanais de NDVI via Copernicus (legado)."""
    from copernicus import calcular_estatisticas_ndvi

    data_final = body.data_final or date.today()
    pontos_dict = [{"lat": p.lat, "lng": p.lng} for p in body.poligono]

    relatorios = []
    data_inicio_serie = data_final - timedelta(days=365)
    inicio_semana = data_inicio_serie
    indice_semana = 1

    while inicio_semana <= data_final:
        fim_semana = min(inicio_semana + timedelta(days=6), data_final)
        referencia_semana = f"S{indice_semana:02d}-{inicio_semana.isoformat()}_{fim_semana.isoformat()}"

        try:
            stats = calcular_estatisticas_ndvi(
                poligono_frontend=pontos_dict,
                data_inicial=inicio_semana.isoformat(),
                data_final=fim_semana.isoformat(),
            )
            relatorios.append(
                NdviResponse.RelatorioSemanal(
                    referencia_semana=referencia_semana,
                    data_inicial=inicio_semana,
                    data_final=fim_semana,
                    ndvi_medio=stats["ndvi_medio"],
                )
            )
        except ValueError as exc:
            relatorios.append(
                NdviResponse.RelatorioSemanal(
                    referencia_semana=referencia_semana,
                    data_inicial=inicio_semana,
                    data_final=fim_semana,
                    erro=str(exc),
                )
            )
        except Exception as exc:
            raise HTTPException(
                status_code=500,
                detail=f"Erro interno ao calcular NDVI semanal ({referencia_semana}): {exc}",
            ) from exc

        inicio_semana = fim_semana + timedelta(days=1)
        indice_semana += 1

    return NdviResponse(
        total_semanas=len(relatorios),
        relatorios=relatorios,
    )


# ---------------------------------------------------------------------------
# Entrada direta via `python main.py`
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
