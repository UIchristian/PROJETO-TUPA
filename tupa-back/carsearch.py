from pathlib import Path

import geopandas as gpd
from shapely.geometry import Polygon


BASE_DIR = Path(__file__).resolve().parent
SHP_CANDIDATES = [
    BASE_DIR / "AREA_IMOVEL" / "AREA_IMOVEL_1.shp",
    BASE_DIR / "AREA_IMOVEL.shp",
]


def _get_shp_path() -> Path:
    for shp_path in SHP_CANDIDATES:
        if shp_path.exists():
            return shp_path
    searched = ", ".join(str(p) for p in SHP_CANDIDATES)
    raise FileNotFoundError(f"Nenhum shapefile encontrado. Caminhos testados: {searched}")


# Caminho resolvido uma vez na importação (sem ler o arquivo inteiro).
SHP_PATH: Path = _get_shp_path()


def _normalize_polygon_points(poligono_frontend):
    if isinstance(poligono_frontend, dict):
        # Suporta formato indexado: {"0": {"lat": ..., "lng": ...}, ...}
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


def buscar_cars(poligono_frontend):
    coords = _normalize_polygon_points(poligono_frontend)
    poly = Polygon(coords)

    if not poly.is_valid:
        poly = poly.buffer(0)
    if poly.is_empty:
        return []

    # Lê do disco apenas os registros dentro do bounding box do polígono.
    # Para um shapefile de ~3 GB isso evita carregar o arquivo inteiro na memória.
    bbox = poly.bounds  # (minx, miny, maxx, maxy)
    gdf = gpd.read_file(SHP_PATH, bbox=bbox)

    if gdf.empty:
        return []

    if gdf.crs is not None and str(gdf.crs) != "EPSG:4326":
        gdf = gdf.to_crs("EPSG:4326")

    # Remove geometrias nulas e corrige inválidas.
    gdf = gdf[gdf.geometry.notnull()].copy()
    if not gdf.empty:
        gdf["geometry"] = gdf.geometry.buffer(0)

    # Filtragem precisa: intersects com o polígono exato (bbox pode trazer falsos positivos).
    resultado = gdf[gdf.intersects(poly)]
    return resultado.to_dict("records")