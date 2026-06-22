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
        file_path_gpkg = BASE_DIR / "data" / municipio / "declarado.gpkg"
        file_path_geojson = BASE_DIR / "data" / municipio / "declarado.geojson"
        
        file_path = None
        if file_path_gpkg.exists():
            file_path = file_path_gpkg
        elif file_path_geojson.exists():
            file_path = file_path_geojson
            
        if not file_path:
            logger.warning(f"Arquivo declarado não encontrado para {municipio}")
            return
            
        logger.info(f"Carregando polígonos declarados para {municipio} de {file_path.name}...")
        gdf = gpd.read_file(file_path)
        
        # Converte para EPSG:4326 se não estiver
        if gdf.crs and gdf.crs.to_string() != "EPSG:4326":
            gdf = gdf.to_crs("EPSG:4326")
            
        for _, row in gdf.iterrows():
            cod_imovel = row.get("cod_imovel")
            if not cod_imovel:
                # Fallback in case the file doesn't have cod_imovel
                cod_imovel = row.get("numero_car", "CAR_INVALIDO")
                
            imovel_id = f"imovel_{cod_imovel}"
            uf = str(cod_imovel)[:2] if len(str(cod_imovel)) >= 2 else "XX"
            
            # Verifica se já existe
            existente = db_session.query(Imovel).filter(Imovel.id == imovel_id).first()
            
            wkt_geom = row.geometry.wkt if row.geometry else None
            
            if existente:
                existente.poligono_declarado = f"SRID=4326;{wkt_geom}"
            else:
                novo_imovel = Imovel(
                    id=imovel_id,
                    nome=cod_imovel,
                    municipio=municipio,
                    uf=uf,
                    numero_car=cod_imovel,
                    poligono_declarado=f"SRID=4326;{wkt_geom}" if wkt_geom else None
                )
                db_session.add(novo_imovel)
        
        db_session.commit()
