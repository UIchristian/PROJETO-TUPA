import logging
from pathlib import Path
import geopandas as gpd
from shapely.geometry import MultiPolygon
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
            
        # Remove imóveis antigos do município (cascade apaga coberturas e divergências)
        db_session.query(Imovel).filter(Imovel.municipio == municipio).delete()
        db_session.flush()

        # Deduplica pelo cod_imovel — o shapefile pode ter registros repetidos
        vistos = set()
        inseridos = 0
        for _, row in gdf.iterrows():
            cod_imovel = row.get("cod_imovel") or row.get("numero_car", "CAR_INVALIDO")
            if not cod_imovel or cod_imovel in vistos:
                continue
            vistos.add(cod_imovel)

            imovel_id = f"imovel_{cod_imovel}"
            uf = str(cod_imovel)[:2] if len(str(cod_imovel)) >= 2 else "XX"

            geom = row.geometry
            if geom and geom.geom_type == "Polygon":
                geom = MultiPolygon([geom])
            wkt_geom = geom.wkt if geom else None

            db_session.add(Imovel(
                id=imovel_id,
                nome=cod_imovel,
                municipio=municipio,
                uf=uf,
                numero_car=cod_imovel,
                poligono_declarado=f"SRID=4326;{wkt_geom}" if wkt_geom else None,
            ))
            inseridos += 1

        db_session.commit()
        logger.info(f"{inseridos} imóveis carregados para {municipio} ({len(gdf) - inseridos} duplicatas ignoradas).")
