"""
Prepara os arquivos de entrada para o processamento de Minas Gerais inteiro.

Passos:
  1. Filtra AREA_IMOVEL_1.shp por cod_estado='MG' → data/minas_gerais/declarado.gpkg
  2. Cria hard link de brazil_coverage_2024.tif → data/minas_gerais/mapbiomas.tif
  3. Verifica hidrografia.geojson na raiz do tupa-back
"""
import os
import sys
import logging
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent.parent
MG_DIR = BASE_DIR / "data" / "minas_gerais"
MG_DIR.mkdir(parents=True, exist_ok=True)

# ---------------------------------------------------------------------------
# Passo 1 — declarado.gpkg
# ---------------------------------------------------------------------------
AREA_IMOVEL_CANDIDATES = [
    Path(r"C:\Users\leoan\OneDrive\Desktop\AREA_IMOVEL\AREA_IMOVEL_1.shp"),
    Path(r"C:\Users\leoan\OneDrive\Desktop\tupac\tupa-back\AREA_IMOVEL\AREA_IMOVEL_1.shp"),
]

declarado_dst = MG_DIR / "declarado.gpkg"

if declarado_dst.exists():
    logger.info(f"declarado.gpkg já existe ({declarado_dst.stat().st_size / 1e6:.0f} MB) — pulando passo 1.")
else:
    import geopandas as gpd

    src_shp = next((p for p in AREA_IMOVEL_CANDIDATES if p.exists()), None)
    if src_shp is None:
        logger.error("AREA_IMOVEL_1.shp não encontrado em nenhum caminho esperado.")
        sys.exit(1)

    logger.info(f"Lendo AREA_IMOVEL filtrando por cod_estado='MG'...")
    logger.info(f"  Fonte: {src_shp}")
    gdf = gpd.read_file(src_shp, where="cod_estado = 'MG'")
    logger.info(f"  {len(gdf)} imóveis encontrados para MG.")

    if gdf.crs and gdf.crs.to_epsg() != 4326:
        gdf = gdf.to_crs("EPSG:4326")

    logger.info(f"Salvando em {declarado_dst}...")
    gdf.to_file(declarado_dst, driver="GPKG")
    logger.info(f"  Salvo: {declarado_dst.stat().st_size / 1e6:.0f} MB")

# ---------------------------------------------------------------------------
# Passo 2 — mapbiomas.tif (hard link, sem copiar 765MB)
# ---------------------------------------------------------------------------
MAPBIOMAS_CANDIDATES = [
    Path(r"C:\Users\leoan\Downloads\brazil_coverage_2024.tif"),
    Path(r"C:\Users\leoan\OneDrive\Desktop\tupac\tupa-back\brazil_coverage_2024.tif"),
]

mapbiomas_dst = MG_DIR / "mapbiomas.tif"

if mapbiomas_dst.exists():
    logger.info(f"mapbiomas.tif já existe ({mapbiomas_dst.stat().st_size / 1e6:.0f} MB) — pulando passo 2.")
else:
    mapbiomas_src = next((p for p in MAPBIOMAS_CANDIDATES if p.exists()), None)
    if mapbiomas_src is None:
        logger.error("brazil_coverage_2024.tif não encontrado.")
        sys.exit(1)

    logger.info(f"Criando hard link: {mapbiomas_dst}")
    logger.info(f"  → {mapbiomas_src}")
    try:
        os.link(mapbiomas_src, mapbiomas_dst)
        logger.info(f"  Hard link criado com sucesso.")
    except OSError as e:
        logger.warning(f"Hard link falhou ({e}), copiando arquivo...")
        import shutil
        shutil.copy2(mapbiomas_src, mapbiomas_dst)
        logger.info(f"  Copiado: {mapbiomas_dst.stat().st_size / 1e6:.0f} MB")

# ---------------------------------------------------------------------------
# Passo 3 — hidrografia.geojson na raiz do tupa-back
# ---------------------------------------------------------------------------
hidro_global = BASE_DIR / "hidrografia.geojson"

if hidro_global.exists():
    logger.info(f"hidrografia.geojson OK: {hidro_global.stat().st_size / 1e6:.0f} MB — adapter auto-extrai por bbox.")
else:
    HIDRO_CANDIDATES = [
        Path(r"C:\Users\leoan\Downloads\Base_Hidrogr%C3%A1fica_Ottocodificada_2017_5K_-_trecho_de_drenagem.geojson"),
        Path(r"C:\Users\leoan\Downloads\Base_Hidrográfica_Ottocodificada_2017_5K_-_trecho_de_drenagem.geojson"),
    ]
    hidro_src = next((p for p in HIDRO_CANDIDATES if p.exists()), None)
    if hidro_src:
        logger.info(f"Criando hard link de hidrografia...")
        try:
            os.link(hidro_src, hidro_global)
            logger.info(f"  Hard link criado.")
        except OSError:
            logger.warning("Hard link falhou — crie manualmente ou mova o arquivo.")
    else:
        logger.warning("hidrografia.geojson não encontrado. O adapter de hidrografia vai pular.")

logger.info("\n=== Preparação concluída ===")
logger.info(f"  declarado.gpkg : {declarado_dst}")
logger.info(f"  mapbiomas.tif  : {mapbiomas_dst}")
logger.info(f"  hidrografia    : {hidro_global}")
