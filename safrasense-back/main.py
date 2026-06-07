from contextlib import asynccontextmanager
from datetime import date, timedelta
from typing import List

import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, field_validator, model_validator

import carsearch
from carsearch import buscar_cars
from copernicus import calcular_estatisticas_ndvi


# ---------------------------------------------------------------------------
# Modelos de entrada / saída
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
    print(f"Servidor pronto — shapefile: {carsearch.SHP_PATH}")
    yield


app = FastAPI(
    title="CAR Search API",
    description="Busca imóveis do CAR que intersectam um polígono geográfico.",
    version="1.0.0",
    lifespan=lifespan,
)

# Permite chamadas do frontend (ajuste origins conforme necessário)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Rotas
# ---------------------------------------------------------------------------

@app.get("/health")
def health():
    """Verifica se o servidor está no ar."""
    return {"status": "ok"}


@app.post("/buscar-cars", response_model=BuscarCarsResponse)
def buscar_cars_endpoint(body: BuscarCarsRequest):
    """
    Recebe uma lista de pontos (lat/lng) formando um polígono e retorna
    todos os registros do CAR que intersectam essa área.

    Exemplo de body:
    ```json
    {
      "poligono": [
        {"lat": -16.360, "lng": -46.896},
        {"lat": -16.366, "lng": -46.902},
        {"lat": -16.368, "lng": -46.887}
      ]
    }
    ```
    """
    pontos_dict = [{"lat": p.lat, "lng": p.lng} for p in body.poligono]

    try:
        resultado = buscar_cars(pontos_dict)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Erro interno: {exc}") from exc

    # Serializa geometrias Shapely que não são JSON-serializable nativamente
    cars_serializados = []
    for record in resultado:
        row = {}
        for k, v in record.items():
            try:
                # Testa serialização básica; se falhar, converte para string
                import json
                json.dumps(v)
                row[k] = v
            except (TypeError, ValueError):
                row[k] = str(v)
        cars_serializados.append(row)

    return BuscarCarsResponse(total=len(cars_serializados), cars=cars_serializados)


@app.post("/ndvi", response_model=NdviResponse)
@app.post("/nvdi", response_model=NdviResponse)
def calcular_ndvi_endpoint(body: NdviRequest):
    """
    Recebe uma lista de pontos (lat/lng) formando um poligono e retorna
    relatorios semanais de NDVI dos ultimos 4 anos.

    data_final (opcional) ancora a ultima semana da serie. Se nao enviar,
    usa a data atual.
    """
    data_final = body.data_final or date.today()

    pontos_dict = [{"lat": p.lat, "lng": p.lng} for p in body.poligono]

    relatorios = []
    data_inicio_serie = data_final - timedelta(days=1460)
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
