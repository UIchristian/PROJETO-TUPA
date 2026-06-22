import logging
from pathlib import Path
import geopandas as gpd
from sqlalchemy.orm import Session
from db.models import Hidrografia
from . import BaseSourceAdapter

logger = logging.getLogger(__name__)
BASE_DIR = Path(__file__).resolve().parent.parent

class HidrografiaSourceAdapter(BaseSourceAdapter):
    """Carrega dados da rede de drenagem (ANA/IBGE)."""

    def load_data(self, municipio: str, db_session: Session):
        logger.info(f"Carregando hidrografia (rede de drenagem) para {municipio}...")
        
        file_path = BASE_DIR / "data" / municipio / "hidrografia.gpkg"
        if not file_path.exists():
            logger.warning(f"Arquivo hidrografia não encontrado: {file_path}")
            return
            
        gdf = gpd.read_file(file_path)
        
        if gdf.crs and gdf.crs.to_string() != "EPSG:4326":
            gdf = gdf.to_crs("EPSG:4326")
            
        # Limpa hidrografias antigas do município
        db_session.query(Hidrografia).filter(Hidrografia.municipio == municipio).delete()
        
        for _, row in gdf.iterrows():
            wkt_geom = row.geometry.wkt if row.geometry else None
            if not wkt_geom:
                continue
                
            nova_hidro = Hidrografia(
                municipio=municipio,
                tipo="rio",
                largura=None,
                geometria=f"SRID=4326;{wkt_geom}"
            )
            db_session.add(nova_hidro)
            
        db_session.commit()
        logger.info(f"Hidrografia carregada com sucesso para {municipio}.")
