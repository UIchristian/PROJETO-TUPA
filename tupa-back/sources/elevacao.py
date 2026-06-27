import logging
import numpy as np
from pathlib import Path
from sqlalchemy.orm import Session
from db.models import UsoRestrito
from . import BaseSourceAdapter
from config.settings import regras

logger = logging.getLogger(__name__)
BASE_DIR = Path(__file__).resolve().parent.parent


class ElevacaoSourceAdapter(BaseSourceAdapter):
    """Carrega DEM (SRTM/Copernicus GLO-30) e gera polígonos de declividade.

    Gera duas camadas a partir do DEM:
    - uso_restrito (encosta_25_45): encostas entre 25 e 45 graus (Art. 11)
    - uso_restrito (encosta_acima_45): APP de encosta acima de 45 graus (Art. 4, V)

    Arquivo esperado: data/<municipio>/dem.tif (SRTM ou Copernicus GLO-30, 30m, GeoTIFF)
    """

    def _bbox_municipio(self, municipio: str, db_session: Session):
        """Returns (min_lat, max_lat, min_lon, max_lon) for the municipality's imóveis, or None."""
        from sqlalchemy import text
        try:
            row = db_session.execute(text("""
                SELECT ST_YMin(ext), ST_YMax(ext), ST_XMin(ext), ST_XMax(ext)
                FROM (SELECT ST_Extent(poligono_declarado) AS ext FROM imovel WHERE municipio = :m) t
                WHERE ext IS NOT NULL
            """), {"m": municipio}).first()
            if row and row[0] is not None:
                return (row[0], row[1], row[2], row[3])
        except Exception as e:
            logger.warning(f"Não foi possível obter bbox do município: {e}")
        return None

    def load_data(self, municipio: str, db_session: Session):
        try:
            import rasterio
            from rasterio import features
        except ImportError:
            logger.error("rasterio não instalado. Execute: pip install rasterio")
            return

        dem_path = BASE_DIR / "data" / municipio / "dem.tif"
        if not dem_path.exists():
            _fallback = BASE_DIR / "data" / "minas_gerais" / "dem.tif"
            if _fallback.exists():
                logger.info(f"  DEM municipal não encontrado, usando estadual: {_fallback}")
                dem_path = _fallback
            else:
                logger.warning(f"DEM não encontrado: {dem_path}. Pulando geração de declividade.")
                return

        logger.info(f"Processando DEM para {municipio}...")

        # Clipar DEM à bbox dos imóveis do município (evita processar o estado inteiro)
        bbox = self._bbox_municipio(municipio, db_session)

        with rasterio.open(dem_path) as src:
            if bbox:
                from rasterio.windows import from_bounds
                window = from_bounds(bbox[2], bbox[0], bbox[3], bbox[1],
                                     src.transform)
                dem = src.read(1, window=window).astype("float32")
                transform = src.window_transform(window)
            else:
                dem = src.read(1).astype("float32")
                transform = src.transform
            nodata = src.nodata
            # Resolução em graus → convertida para metros (aproximação)
            res_x_m = abs(transform.a) * 111320
            res_y_m = abs(transform.e) * 111320

        if nodata is not None:
            dem[dem == nodata] = np.nan

        # Gradiente em metros de elevação por metro horizontal
        dy, dx = np.gradient(dem, res_y_m, res_x_m)
        slope_deg = np.degrees(np.arctan(np.sqrt(dx**2 + dy**2)))
        slope_deg = np.where(np.isnan(dem), np.nan, slope_deg)

        db_session.query(UsoRestrito).filter(UsoRestrito.municipio == municipio).delete()

        enc = regras.uso_restrito.encostas
        dmin_ur = enc["declividade_minima"]
        dmax_ur = enc["declividade_maxima"]
        dmin_app = regras.app.encostas["declividade_minima_app"]

        _salvar_faixa(db_session, dem, slope_deg, transform, municipio,
                      dmin_ur, dmax_ur, "encosta_25_45", features)
        _salvar_faixa(db_session, dem, slope_deg, transform, municipio,
                      dmin_app, 90.0, "encosta_acima_45", features)

        db_session.commit()
        logger.info(f"Declividade gerada para {municipio}.")


def _salvar_faixa(db_session, dem, slope_deg, transform, municipio,
                  dmin, dmax, tipo, features):
    from shapely.geometry import shape, MultiPolygon

    mask = ((slope_deg >= dmin) & (slope_deg < dmax))
    mask = np.where(np.isnan(dem), False, mask).astype("uint8")

    count = 0
    for geom_dict, _ in features.shapes(mask, mask=(mask == 1), transform=transform):
        poly = shape(geom_dict)
        if not poly.is_valid:
            poly = poly.buffer(0)
        if poly.area < 1e-8:
            continue
        if poly.geom_type == "Polygon":
            poly = MultiPolygon([poly])
        db_session.add(UsoRestrito(
            municipio=municipio,
            tipo=tipo,
            geometria=f"SRID=4326;{poly.wkt}"
        ))
        count += 1

    logger.info(f"  {tipo}: {count} polígonos inseridos.")
