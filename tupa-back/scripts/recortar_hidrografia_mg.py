"""
Recorta o arquivo BHO global (hidrografia.geojson — América do Sul)
para o estado de Minas Gerais e salva em data/minas_gerais/hidrografia.geojson.

Execute UMA VEZ antes do primeiro processamento:
    cd tupa-back
    python scripts/recortar_hidrografia_mg.py

Resultado: arquivo ~10–20x menor → extração por município fica ~10x mais rápida.

Bounding box de MG (com margem de 0.2°):
    lon: -51.5  a  -39.7
    lat: -23.2  a  -14.0
"""
import json
import sys
import logging
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent.parent
GLOBAL_SRC = BASE_DIR / "hidrografia.geojson"
MG_OUT = BASE_DIR / "data" / "minas_gerais" / "hidrografia.geojson"

# MG bbox com margem
LON_MIN, LON_MAX = -51.5, -39.7
LAT_MIN, LAT_MAX = -23.2, -14.0


def _intersecta(geom: dict) -> bool:
    """Retorna True se qualquer coordenada da geometria estiver dentro do bbox MG."""
    tipo = geom.get("type", "")
    coords = geom.get("coordinates", [])

    def ok(pt) -> bool:
        return LON_MIN <= pt[0] <= LON_MAX and LAT_MIN <= pt[1] <= LAT_MAX

    if tipo == "Point":
        return ok(coords)
    if tipo in ("LineString", "MultiPoint"):
        return any(ok(p) for p in coords)
    if tipo == "MultiLineString":
        return any(ok(p) for linha in coords for p in linha)
    if tipo == "Polygon":
        return any(ok(p) for p in coords[0])
    if tipo == "MultiPolygon":
        return any(ok(p) for poly in coords for p in poly[0])
    return False


def recortar() -> int:
    if not GLOBAL_SRC.exists():
        logger.error(f"Arquivo fonte não encontrado: {GLOBAL_SRC}")
        logger.error("Baixe o BHO em: https://metadados.snirh.gov.br/geonetwork/srv/por/catalog.search#/metadata/a0da46d2-6b35-4a7a-9c3d-5be47e83fdf6")
        return 0

    size_gb = GLOBAL_SRC.stat().st_size / 1e9
    logger.info(f"Fonte: {GLOBAL_SRC.name} ({size_gb:.2f} GB)")
    logger.info(f"Recortando para MG (lon {LON_MIN}–{LON_MAX}, lat {LAT_MIN}–{LAT_MAX})...")

    try:
        import ijson
    except ImportError:
        logger.error("Instale ijson: pip install ijson")
        return 0

    MG_OUT.parent.mkdir(parents=True, exist_ok=True)

    features_mg = []
    total = 0

    with open(GLOBAL_SRC, "rb") as f:
        for feat in ijson.items(f, "features.item"):
            total += 1
            if total % 100_000 == 0:
                logger.info(f"  {total:,} lidas | {len(features_mg):,} em MG...")

            geom = feat.get("geometry")
            if geom and _intersecta(geom):
                features_mg.append(feat)

    logger.info(f"Total lidas: {total:,} | Selecionadas MG: {len(features_mg):,}")

    if not features_mg:
        logger.warning("Nenhuma feição encontrada no bbox de MG. Verifique o arquivo fonte.")
        return 0

    with open(MG_OUT, "w", encoding="utf-8") as out:
        json.dump({"type": "FeatureCollection", "features": features_mg}, out)

    out_mb = MG_OUT.stat().st_size / 1e6
    logger.info(f"Salvo: {MG_OUT} ({out_mb:.1f} MB)")
    logger.info("Pronto! Execute 'python -m uvicorn main:app ...' para recarregar o servidor.")
    return len(features_mg)


if __name__ == "__main__":
    n = recortar()
    sys.exit(0 if n > 0 else 1)
