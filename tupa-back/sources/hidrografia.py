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
_COLUNAS_LARGURA = ["largura", "largura_m", "width", "width_m"]


class HidrografiaSourceAdapter(BaseSourceAdapter):
    """Carrega dados da rede de drenagem (ANA BHO ou IBGE BC250).

    Procura o arquivo nesta ordem:
      1. data/<municipio>/hidrografia.gpkg
      2. data/<municipio>/hidrografia.geojson
      Se não encontrar nenhum, tenta auto-extrair do arquivo global
      hidrografia.geojson na raiz de tupa-back (requer ijson + geopandas).
    """

    def load_data(self, municipio: str, db_session: Session):
        logger.info(f"Carregando hidrografia para {municipio}...")

        file_path = self._resolver_arquivo(municipio)
        if file_path is None:
            logger.warning(f"Hidrografia não encontrada para {municipio}. Pulando.")
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

    def _resolver_arquivo(self, municipio: str) -> Path | None:
        """Retorna o arquivo de hidrografia disponível, extraindo se necessário."""
        mun_dir = BASE_DIR / "data" / municipio

        # 1. Arquivo já extraído para este município
        for nome in ("hidrografia.gpkg", "hidrografia.geojson"):
            p = mun_dir / nome
            if p.exists():
                logger.info(f"  Usando arquivo municipal: {p}")
                return p

        # 2. Extrai a partir do recorte MG (muito menor) ou do global como fallback
        mg_src     = BASE_DIR / "data" / "minas_gerais" / "hidrografia.geojson"
        global_src = BASE_DIR / "hidrografia.geojson"

        src = mg_src if mg_src.exists() else (global_src if global_src.exists() else None)
        if src:
            label = "recorte MG" if src == mg_src else "arquivo global BHO"
            logger.info(f"  Extraindo do {label} ({src.name})...")
            if self._auto_extrair(municipio, src):
                return mun_dir / "hidrografia.gpkg"
        else:
            logger.warning(
                "Nenhum arquivo de hidrografia encontrado. "
                "Execute: python scripts/recortar_hidrografia_mg.py"
            )

        return None

    def _auto_extrair(self, municipio: str, src: Path) -> bool:
        """Extrai feições do arquivo src para a bbox do município."""
        import importlib.util
        script = BASE_DIR / "scripts" / "extrair_hidrografia.py"
        if not script.exists():
            logger.error(f"Script não encontrado: {script}")
            return False

        spec = importlib.util.spec_from_file_location("extrair_hidrografia", script)
        mod  = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)

        bbox = self._bbox_municipio(municipio)
        if bbox is None:
            logger.warning("Bbox do município não encontrada — rode extrair_hidrografia.py manualmente.")
            return False

        lat_min, lat_max, lon_min, lon_max = bbox
        n = mod.extrair(municipio, lat_min, lat_max, lon_min, lon_max, source=src)
        return n > 0

    def _bbox_municipio(self, municipio: str) -> tuple | None:
        """Tenta ler a bbox do municipality a partir dos imóveis já no banco."""
        try:
            from db.database import SessionLocal
            from db.models import Imovel
            from sqlalchemy import text
            with SessionLocal() as db:
                row = db.execute(text("""
                    SELECT
                        ST_YMin(ST_Extent(poligono_declarado)) - 0.1,
                        ST_YMax(ST_Extent(poligono_declarado)) + 0.1,
                        ST_XMin(ST_Extent(poligono_declarado)) - 0.1,
                        ST_XMax(ST_Extent(poligono_declarado)) + 0.1
                    FROM imovel WHERE municipio = :m
                """), {"m": municipio}).fetchone()
                if row and row[0] is not None:
                    return tuple(row)
        except Exception as e:
            logger.debug(f"bbox_municipio falhou: {e}")
        return None


def _extrair_largura(row, col_largura: str | None, geom) -> float | None:
    if col_largura:
        val = row.get(col_largura)
        if val is not None and not (isinstance(val, float) and np.isnan(val)):
            try:
                return float(val)
            except (TypeError, ValueError):
                pass

    # Para polígonos de massa d'água estima largura como área / comprimento
    if geom is not None and geom.geom_type in ("Polygon", "MultiPolygon"):
        try:
            from shapely.ops import transform
            import pyproj
            proj = pyproj.Transformer.from_crs("EPSG:4326", "EPSG:5880",
                                                always_xy=True).transform
            geom_m = transform(proj, geom)
            comprimento = geom_m.length
            if comprimento > 0:
                return round(geom_m.area / comprimento, 1)
        except Exception:
            pass

    return None


def _inferir_tipo(geom, row) -> str:
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
