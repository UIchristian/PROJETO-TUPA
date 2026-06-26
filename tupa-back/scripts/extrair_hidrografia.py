"""
Extrai feições hidrográficas de um GeoJSON grande (América do Sul)
para a bbox de um município, estimando largura pelo índice de Strahler.

Uso:
    python extrair_hidrografia.py <municipio> <lat_min> <lat_max> <lon_min> <lon_max>

Exemplo (Abadia dos Dourados, MG):
    python extrair_hidrografia.py abadia_dos_dourados -18.85 -18.10 -47.85 -46.95

Fonte esperada: tupa-back/hidrografia.geojson (BHO/ANA — América do Sul)
Saída:         tupa-back/data/<municipio>/hidrografia.gpkg
"""
import sys
import json
import logging
from pathlib import Path
from decimal import Decimal

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent.parent
SOURCE   = BASE_DIR / "hidrografia.geojson"

# Largura estimada (metros) por ordem de Strahler — referência ANA
_LARGURA_STRAHLER = {
    1: 2.0,
    2: 5.0,
    3: 10.0,
    4: 20.0,
    5: 50.0,
    6: 100.0,
    7: 200.0,
    8: 400.0,
    9: 600.0,
}

# Largura estimada (metros) por área de contribuição (km²) — fallback se Strahler nulo
def _largura_por_area(area_km2: float) -> float:
    if area_km2 < 10:    return 2.0
    if area_km2 < 100:   return 8.0
    if area_km2 < 1000:  return 25.0
    if area_km2 < 5000:  return 70.0
    return 150.0


def _geom_intersecta_bbox(geom: dict, xmin, ymin, xmax, ymax) -> bool:
    """Verifica se qualquer ponto da geometria está dentro ou próximo da bbox."""
    tipo = geom.get("type", "")
    coords = geom.get("coordinates", [])

    def ponto_ok(pt):
        return xmin <= pt[0] <= xmax and ymin <= pt[1] <= ymax

    if tipo == "Point":
        return ponto_ok(coords)

    if tipo in ("LineString", "MultiPoint"):
        return any(ponto_ok(p) for p in coords)

    if tipo == "MultiLineString":
        for linha in coords:
            if any(ponto_ok(p) for p in linha):
                return True
        return False

    if tipo == "Polygon":
        return any(ponto_ok(p) for p in coords[0])

    if tipo == "MultiPolygon":
        for poly in coords:
            if any(ponto_ok(p) for p in poly[0]):
                return True
        return False

    return False


def extrair(municipio: str, lat_min: float, lat_max: float,
            lon_min: float, lon_max: float) -> int:
    try:
        import ijson
    except ImportError:
        logger.error("ijson não instalado. Execute: pip install ijson")
        return 0

    dest_dir = BASE_DIR / "data" / municipio
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / "hidrografia.gpkg"

    if not SOURCE.exists():
        logger.error(f"Arquivo fonte não encontrado: {SOURCE}")
        return 0

    logger.info(f"Extraindo hidrografia para {municipio} (bbox: {lon_min},{lat_min} → {lon_max},{lat_max})")
    logger.info(f"Fonte: {SOURCE.name} ({SOURCE.stat().st_size/1e9:.2f} GB) — aguarde...")

    features_out = []
    total_lidos  = 0

    with open(SOURCE, "rb") as f:
        for feat in ijson.items(f, "features.item"):
            total_lidos += 1
            if total_lidos % 50000 == 0:
                logger.info(f"  {total_lidos:,} features lidas, {len(features_out)} na bbox...")

            geom = feat.get("geometry")
            if not geom:
                continue
            if not _geom_intersecta_bbox(geom, lon_min, lat_min, lon_max, lat_max):
                continue

            props = feat.get("properties", {})

            # Converte Decimal → float (ijson retorna Decimal para números)
            def _f(v):
                if v is None:
                    return None
                try:
                    return float(v)
                except (TypeError, ValueError):
                    return None

            strahler  = props.get("NUSTRAHLER")
            area_contr = _f(props.get("NUAREACONT"))

            if strahler and int(strahler) in _LARGURA_STRAHLER:
                largura = _LARGURA_STRAHLER[int(strahler)]
            elif area_contr:
                largura = _largura_por_area(area_contr)
            else:
                largura = None  # adapter aplica piso de 30m

            features_out.append({
                "type": "Feature",
                "geometry": geom,
                "properties": {
                    "tipo":         "rio",
                    "largura":      largura,
                    "strahler":     int(strahler) if strahler else None,
                    "nome_rio":     props.get("NORIOCOMP") or props.get("NOORIGINAL"),
                    "area_contr_km2": area_contr,
                    "comprimento_m": _f(props.get("NUCOMPTREC")),
                },
            })

    logger.info(f"Total lidas: {total_lidos:,} | Selecionadas: {len(features_out)}")

    if not features_out:
        logger.warning("Nenhuma feição encontrada na bbox. Verifique as coordenadas.")
        return 0

    # Salva como GeoPackage via geopandas
    try:
        import geopandas as gpd
        gdf = gpd.GeoDataFrame.from_features(features_out, crs="EPSG:4326")
        gdf.to_file(dest, driver="GPKG")
        logger.info(f"Salvo: {dest} ({len(gdf)} feições)")
    except Exception as e:
        logger.error(f"Erro ao salvar GeoPackage: {e}")
        # Fallback: salva como GeoJSON simples
        dest_json = dest_dir / "hidrografia.geojson"
        with open(dest_json, "w", encoding="utf-8") as out:
            json.dump({"type": "FeatureCollection", "features": features_out}, out)
        logger.info(f"Salvo como GeoJSON: {dest_json} ({len(features_out)} feições)")

    return len(features_out)


if __name__ == "__main__":
    sys.path.insert(0, str(BASE_DIR))

    if len(sys.argv) == 6:
        mun     = sys.argv[1]
        lat_min = float(sys.argv[2])
        lat_max = float(sys.argv[3])
        lon_min = float(sys.argv[4])
        lon_max = float(sys.argv[5])
    else:
        # Default: Abadia dos Dourados, MG
        mun     = "abadia_dos_dourados"
        lat_min, lat_max = -18.85, -18.10
        lon_min, lon_max = -47.85, -46.95

    n = extrair(mun, lat_min, lat_max, lon_min, lon_max)
    print(f"\n{n} feições extraídas para {mun}.")
