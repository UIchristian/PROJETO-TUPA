"""
Tupã API — Schemas Pydantic (contrato da API).

Estes modelos são a fonte da verdade que o front consome.
"""
from __future__ import annotations

from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# GeoJSON
# ---------------------------------------------------------------------------

class GeoJSONGeometry(BaseModel):
    type: str = Field(..., examples=["Polygon"])
    coordinates: list[Any] = Field(..., description="GeoJSON coordinates array")


# ---------------------------------------------------------------------------
# Imóvel
# ---------------------------------------------------------------------------

class ImovelBase(BaseModel):
    nome: str
    municipio: str
    uf: str
    area_hectares: float = Field(..., gt=0)
    numero_car: str
    poligono_declarado: GeoJSONGeometry


class ImovelResponse(ImovelBase):
    id: str


class ImovelCreateRequest(BaseModel):
    nome: str
    municipio: str
    uf: str
    numero_car: str = ""
    poligono: GeoJSONGeometry = Field(
        ..., description="Polígono do imóvel em GeoJSON (Polygon)"
    )


# ---------------------------------------------------------------------------
# Diagnóstico — cobertura
# ---------------------------------------------------------------------------

class CoberturaClasse(BaseModel):
    classe: str
    percentual: float = Field(..., ge=0, le=100)
    cor_hex: str = Field(..., examples=["#15803D"])


class CoberturaPoligono(BaseModel):
    classe: str
    cor_hex: str
    geometry: GeoJSONGeometry


# ---------------------------------------------------------------------------
# Divergência
# ---------------------------------------------------------------------------

class Severidade(str, Enum):
    ALTA = "alta"
    MEDIA = "media"
    BAIXA = "baixa"


class DivergenciaResponse(BaseModel):
    id: str
    tipo: str
    area_hectares: float = Field(..., ge=0)
    severidade: Severidade
    texto_linguagem_simples: str
    base_legal: str = ""
    caminho_retificacao: str
    poligono_divergencia: GeoJSONGeometry


# ---------------------------------------------------------------------------
# Camadas (layers para o mapa)
# ---------------------------------------------------------------------------

class LayerGeometriesResponse(BaseModel):
    poligono_declarado: GeoJSONGeometry
    app: GeoJSONGeometry
    uso_restrito: GeoJSONGeometry | None = None
    gabarito: GeoJSONGeometry | None = None
    divergencias: list[DivergenciaResponse] = []
    cobertura_poligonos: list[CoberturaPoligono] = []


# ---------------------------------------------------------------------------
# Diagnóstico completo
# ---------------------------------------------------------------------------

class DiagnosticoResponse(BaseModel):
    imovel_id: str
    score_conformidade: float = Field(..., ge=0, le=100)
    cobertura_solo: list[CoberturaClasse] = []
    camadas: LayerGeometriesResponse
    divergencias: list[DivergenciaResponse] = []
