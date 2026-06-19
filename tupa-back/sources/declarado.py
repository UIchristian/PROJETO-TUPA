import logging
from pathlib import Path
import geopandas as gpd
from sqlalchemy.orm import Session
from . import BaseSourceAdapter
from db.models import Imovel

logger = logging.getLogger(__name__)
BASE_DIR = Path(__file__).resolve().parent.parent

class DeclaradoSourceAdapter(BaseSourceAdapter):
    """Lê os polígonos declarados do CAR (arquivos GeoJSON/SHP)."""

    def load_data(self, municipio: str, db_session: Session):
        file_path = BASE_DIR / "data" / municipio / "declarado.geojson"
        if not file_path.exists():
            logger.warning(f"Arquivo declarado não encontrado: {file_path}")
            return
            
        logger.info(f"Carregando polígonos declarados para {municipio}...")
        gdf = gpd.read_file(file_path)
        
        # Converte para EPSG:4326 se não estiver
        if gdf.crs and gdf.crs.to_string() != "EPSG:4326":
            gdf = gdf.to_crs("EPSG:4326")
            
        for _, row in gdf.iterrows():
            imovel_id = row.get("id", f"imovel_{row.get('numero_car')}")
            # Verifica se já existe
            existente = db_session.query(Imovel).filter(Imovel.id == imovel_id).first()
            
            wkt_geom = row.geometry.wkt if row.geometry else None
            
            if existente:
                existente.poligono_declarado = f"SRID=4326;{wkt_geom}"
            else:
                novo_imovel = Imovel(
                    id=imovel_id,
                    nome=row.get("nome", "Desconhecido"),
                    municipio=municipio,
                    uf=row.get("uf", "XX"),
                    numero_car=row.get("numero_car", "CAR_INVALIDO"),
                    poligono_declarado=f"SRID=4326;{wkt_geom}" if wkt_geom else None
                )
                db_session.add(novo_imovel)
        
        db_session.commit()
