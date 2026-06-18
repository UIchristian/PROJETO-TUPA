"""
Tupã — Modelo de domínio interno.

Dataclasses com geometrias Shapely, usadas pelo motor de comparação.
Não são serializáveis diretamente — os schemas.py convertem para a API.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Optional

from shapely.geometry.base import BaseGeometry


class TipoDivergencia(str, Enum):
    CULTIVO_EM_APP = "Cultivo Agrícola em APP"
    SUPRESSAO_VEGETACAO = "Supressão não autorizada de vegetação"
    USO_INCOMPATIVEL_RESTRITO = "Uso incompatível em área de uso restrito"


class SeveridadeDivergencia(str, Enum):
    ALTA = "alta"
    MEDIA = "media"
    BAIXA = "baixa"


@dataclass
class Imovel:
    id: str
    nome: str
    municipio: str
    uf: str
    numero_car: str
    poligono: BaseGeometry  # Shapely geometry (Polygon/MultiPolygon)

    @property
    def area_hectares(self) -> float:
        """Area placeholder — real calculation uses reprojected geometry."""
        return 0.0


@dataclass
class Divergencia:
    tipo: TipoDivergencia
    geometria: BaseGeometry
    area_hectares: float
    severidade: SeveridadeDivergencia
    descricao: str
    base_legal: str
    caminho_retificacao: str

    id: str = ""

    def __post_init__(self):
        if not self.id:
            import hashlib
            h = hashlib.md5(self.geometria.wkt.encode()).hexdigest()[:8]
            self.id = f"div-{self.tipo.value[:3].lower()}-{h}"


@dataclass
class CoberturaClasse:
    classe: str
    percentual: float
    cor_hex: str
    geometria: Optional[BaseGeometry] = None


@dataclass
class Gabarito:
    """
    Gabarito de uso e cobertura do imóvel.

    Montado a partir das bases oficiais (SNIF), atualizado com satélite
    (Dynamic World / GEE), e comparado com o declarado no CAR.
    """
    vegetacao_nativa: BaseGeometry | None = None
    hidrografia: BaseGeometry | None = None
    app: BaseGeometry | None = None  # Buffer de 30m da hidrografia, clippado pelo imóvel
    uso_restrito: BaseGeometry | None = None
    cobertura: list[CoberturaClasse] = field(default_factory=list)


@dataclass
class DiagnosticoResult:
    imovel_id: str
    score_conformidade: float
    cobertura_solo: list[CoberturaClasse]
    divergencias: list[Divergencia]
    gabarito: Gabarito
    poligono_declarado: BaseGeometry | None = None
