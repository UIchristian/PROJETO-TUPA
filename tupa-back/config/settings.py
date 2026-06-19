import yaml
from pathlib import Path
from pydantic import BaseModel
from typing import List, Dict

BASE_DIR = Path(__file__).resolve().parent.parent
CONFIG_PATH = BASE_DIR / "config" / "regras_florestais.yaml"

class FaixaApp(BaseModel):
    largura_max: float
    distancia_app: float

class CursosDagua(BaseModel):
    faixas: List[FaixaApp]

class Nascentes(BaseModel):
    raio_app: float

class AppConfig(BaseModel):
    cursos_dagua: CursosDagua
    nascentes: Nascentes
    encostas: Dict[str, float]

class UsoRestritoConfig(BaseModel):
    encostas: Dict[str, float]

class ReservaLegalBiomas(BaseModel):
    amazonia_legal: Dict[str, float]
    demais_regioes: Dict[str, float]

class ReservaLegalConfig(BaseModel):
    biomas: ReservaLegalBiomas

class DispensasConfig(BaseModel):
    pequena_propriedade_modulos_max: float

class RegrasFlorestais(BaseModel):
    app: AppConfig
    uso_restrito: UsoRestritoConfig
    reserva_legal: ReservaLegalConfig
    dispensas: DispensasConfig

def load_regras() -> RegrasFlorestais:
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)
    return RegrasFlorestais(**data)

regras = load_regras()
