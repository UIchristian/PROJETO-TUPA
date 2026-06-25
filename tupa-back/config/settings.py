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

class LagosLagoasNaturais(BaseModel):
    rural_padrao: float
    rural_ate_20ha: float
    urbano: float
    limiar_area_reduzida_ha: float
    dispensa_inferior_ha: float

class Veredas(BaseModel):
    faixa_marginal: float

class ReservatoriosArtificiais(BaseModel):
    rural_ate_20ha_minimo: float
    exige_barramento_curso_natural: bool

class TopoMorro(BaseModel):
    altura_minima_m: float
    inclinacao_media_minima_graus: float

class Altitude(BaseModel):
    altitude_minima_m: float

class AppConfig(BaseModel):
    cursos_dagua: CursosDagua
    nascentes: Nascentes
    lagos_lagoas_naturais: LagosLagoasNaturais
    veredas: Veredas
    reservatorios_artificiais: ReservatoriosArtificiais
    encostas: Dict[str, float]
    topo_morro: TopoMorro
    altitude: Altitude

class UsoRestritoConfig(BaseModel):
    encostas: Dict[str, float]

class ReservaLegalBiomas(BaseModel):
    amazonia_legal: Dict[str, float]
    demais_regioes: Dict[str, float]

class ReservaLegalConfig(BaseModel):
    biomas: ReservaLegalBiomas
    art_67_modulos_fiscais_max: int = 4
    art_68_apenas_documental: bool = True

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
