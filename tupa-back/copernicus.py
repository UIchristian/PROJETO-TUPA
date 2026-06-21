import os

import numpy as np
from shapely.geometry import Polygon


CDSE_BASE_URL = "https://sh.dataspace.copernicus.eu"
CDSE_TOKEN_URL = "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token"


COPERNICUS_CLIENT_ID = "sh-6f724141-af8b-4f18-a033-17ec974c40b4"
COPERNICUS_CLIENT_SECRET = "KichKue5UQ48towv9Bx1UwsQhbDd8WwE"

EVALSCRIPT_NDVI = """
//VERSION=3
function setup() {
  return {
    input: ["B04", "B08"],
    output: {
      bands: 1,
      sampleType: "FLOAT32"
    }
  };
}

function evaluatePixel(sample) {
  let ndvi = (sample.B08 - sample.B04) / (sample.B08 + sample.B04);
  return [ndvi];
}
"""


def _normalize_polygon_points(poligono_frontend):
    if isinstance(poligono_frontend, dict):
        ordered_keys = sorted(poligono_frontend.keys(), key=lambda k: int(k))
        points = [poligono_frontend[k] for k in ordered_keys]
    elif isinstance(poligono_frontend, list):
        points = poligono_frontend
    else:
        raise ValueError("poligono_frontend deve ser uma lista ou dict indexado")

    coords = []
    for idx, p in enumerate(points):
        if not isinstance(p, dict) or "lat" not in p or "lng" not in p:
            raise ValueError(f"Ponto invalido na posicao {idx}. Esperado: {{'lat': ..., 'lng': ...}}")

        try:
            lat = float(p["lat"])
            lng = float(p["lng"])
        except (TypeError, ValueError) as exc:
            raise ValueError(f"Lat/Lng invalidos na posicao {idx}: {p}") from exc

        coords.append((lng, lat))

    if len(coords) < 3:
        raise ValueError("O poligono precisa ter pelo menos 3 pontos")

    return coords


def _build_sh_config():
    from sentinelhub import SHConfig

    client_id = os.getenv("COPERNICUS_CLIENT_ID") or os.getenv("SH_CLIENT_ID")
    client_secret = os.getenv("COPERNICUS_CLIENT_SECRET") or os.getenv("SH_CLIENT_SECRET")

    if not client_id or not client_secret:
        raise ValueError(
            "Credenciais do Copernicus ausentes. Defina COPERNICUS_CLIENT_ID e "
            "COPERNICUS_CLIENT_SECRET no codigo ou nas variaveis de ambiente."
        )

    config = SHConfig()
    config.sh_client_id = client_id
    config.sh_client_secret = client_secret
    config.sh_base_url = CDSE_BASE_URL
    config.sh_token_url = CDSE_TOKEN_URL
    return config


def calcular_estatisticas_ndvi(poligono_frontend, data_inicial: str, data_final: str, size=(512, 512)):
    try:
        from sentinelhub import CRS, DataCollection, Geometry, MimeType, SentinelHubRequest
    except ImportError as exc:
        raise RuntimeError(
            "Dependencia ausente: instale 'sentinelhub' (pip install -r requirements.txt)."
        ) from exc

    coords = _normalize_polygon_points(poligono_frontend)
    poly = Polygon(coords)

    if not poly.is_valid:
        poly = poly.buffer(0)
    if poly.is_empty:
        raise ValueError("Poligono invalido ou vazio apos correcao geometrica")

    geometry = Geometry(poly, CRS.WGS84)
    config = _build_sh_config()

    s2l2a_cdse = DataCollection.SENTINEL2_L2A.define_from(
        name="S2L2A_CDSE",
        service_url=config.sh_base_url,
    )

    request = SentinelHubRequest(
        evalscript=EVALSCRIPT_NDVI,
        input_data=[
            SentinelHubRequest.input_data(
                data_collection=s2l2a_cdse,
                time_interval=(data_inicial, data_final),
            )
        ],
        responses=[SentinelHubRequest.output_response("default", MimeType.TIFF)],
        geometry=geometry,
        size=size,
        config=config,
    )

    data = request.get_data()
    if not data:
        raise ValueError("Nenhum dado NDVI retornado para o periodo/poligono informado")

    ndvi = np.asarray(data[0], dtype=float)
    valid_values = ndvi[np.isfinite(ndvi)]

    if valid_values.size == 0:
        raise ValueError("Nao ha pixels validos de NDVI para o periodo/poligono informado")

    return {
        "ndvi_minimo": float(np.min(valid_values)),
        "ndvi_medio": float(np.mean(valid_values)),
        "ndvi_maximo": float(np.max(valid_values)),
        "pixels_validos": int(valid_values.size),
        "pixels_total": int(ndvi.size),
    }