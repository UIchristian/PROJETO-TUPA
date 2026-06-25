import logging
import numpy as np
from pathlib import Path
import geopandas as gpd
from sqlalchemy.orm import Session
from db.models import Hidrografia
from . import BaseSourceAdapter

logger = logging.getLogger(__name__)
BASE_DIR = Path(__file__).resolve().parent.parent

# Colunas candidatas a largura nos arquivos da ANA/IBGE
_COLUNAS_LARGURA = ["largura", "largura_m", "width", "width_m", "ordem_strahler"]


class HidrografiaSourceAdapter(BaseSourceAdapter):
    """Carrega dados da rede de drenagem (ANA/IBGE).

    Tenta ler a largura do rio do atributo do arquivo. Se não encontrar,
    estima a largura para feições do tipo polígono (massas d'água) a partir
    de area/comprimento. Para linhas sem atributo de largura, mantém NULL —
    o motor aplica o piso legal de 30m (conservador e defensável).
    """

    def load_data(self, municipio: str, db_session: Session):
        logger.info(f"Carregando hidrografia para {municipio}...")

        file_path = BASE_DIR / "data" / municipio / "hidrografia.gpkg"
        if not file_path.exists():
            logger.warning(f"Arquivo hidrografia não encontrado: {file_path}")
            return

        gdf = gpd.read_file(file_path)

        if gdf.crs and gdf.crs.to_epsg() != 4326:
            gdf = gdf.to_crs("EPSG:4326")

        db_session.query(Hidrografia).filter(Hidrografia.municipio == municipio).delete()

        col_largura = next((c for c in _COLUNAS_LARGURA if c in gdf.columns), None)

        inseridos = 0
        for _, row in gdf.iterrows():
            geom = row.geometry
            if geom is None:
                continue

            largura = _extrair_largura(row, col_largura, geom)
            tipo = _inferir_tipo(geom, row)

            db_session.add(Hidrografia(
                municipio=municipio,
                tipo=tipo,
                largura=largura,
                geometria=f"SRID=4326;{geom.wkt}",
            ))
            inseridos += 1

        db_session.commit()
        logger.info(f"Hidrografia carregada: {inseridos} feições para {municipio}.")


def _extrair_largura(row, col_largura: str | None, geom) -> float | None:
    """Retorna largura em metros ou None."""
    if col_largura:
        val = row.get(col_largura)
        if val is not None and not (isinstance(val, float) and np.isnan(val)):
            try:
                return float(val)
            except (TypeError, ValueError):
                pass

    # Para polígonos de massa d'água, estima largura como área / comprimento do eixo maior
    if geom is not None and geom.geom_type in ("Polygon", "MultiPolygon"):
        try:
            # Reprojeção para SIRGAS 2000 Policônica (EPSG:5880) para cálculo em metros
            from shapely.ops import transform
            import pyproj
            proj = pyproj.Transformer.from_crs("EPSG:4326", "EPSG:5880", always_xy=True).transform
            geom_m = transform(proj, geom)
            comprimento = geom_m.length
            area_m2 = geom_m.area
            if comprimento > 0:
                return round(area_m2 / comprimento, 1)
        except Exception:
            pass

    return None


def _inferir_tipo(geom, row) -> str:
    """Classifica o tipo de feição hídrica."""
    tipo_col = next(
        (row.get(c) for c in ["tipo", "type", "cobem_tipo", "natureza"] if c in row.index),
        None,
    )
    if tipo_col:
        t = str(tipo_col).lower()
        if "nasc" in t:
            return "nascente"
        if "lago" in t or "repres" in t or "reserv" in t:
            return "lago"
        if "vered" in t:
            return "vereda"

    if geom is not None and geom.geom_type in ("Polygon", "MultiPolygon"):
        return "lago"

    return "rio"
