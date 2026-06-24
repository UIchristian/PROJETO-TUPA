import os
import logging
import numpy as np
import rasterio
import rasterio.features
from shapely.geometry import shape, MultiPolygon
from sqlalchemy import text
from datetime import datetime, timedelta
from geoalchemy2.shape import to_shape

from db.models import Imovel, CoberturaObservada
from . import BaseSourceAdapter

logger = logging.getLogger(__name__)

# Constantes de limiar
NDWI_WATER_THRESHOLD = 0.2
NDVI_FOREST_THRESHOLD = 0.6
NDVI_PASTURE_CROP_THRESHOLD = 0.3

EVALSCRIPT = """
//VERSION=3
function setup() {
  return {
    input: ["B03", "B04", "B08", "B11", "dataMask"],
    output: {
      bands: 5,
      sampleType: "FLOAT32"
    }
  };
}
function evaluatePixel(sample) {
  return [sample.B03, sample.B04, sample.B08, sample.B11, sample.dataMask];
}
"""

class SentinelSourceAdapter(BaseSourceAdapter):
    """
    Adapter para o Copernicus Data Space Ecosystem.
    Puxa a imagem mais recente do Sentinel-2.
    """
    CREDIT_TEXT = "Contains modified Copernicus Sentinel data 2026"

    def load_data(self, municipio: str, db_session):
        logger.info(f"Fazendo download da imagem Sentinel-2 para {municipio}...")
        logger.info(self.CREDIT_TEXT)

        # 1. Obter BBox do municipio baseada nos imoveis
        bbox_query = text("""
            SELECT 
                ST_XMin(ST_Extent(poligono_declarado)) as xmin,
                ST_YMin(ST_Extent(poligono_declarado)) as ymin,
                ST_XMax(ST_Extent(poligono_declarado)) as xmax,
                ST_YMax(ST_Extent(poligono_declarado)) as ymax
            FROM imovel WHERE municipio = :municipio
        """)
        row = db_session.execute(bbox_query, {"municipio": municipio}).fetchone()
        if not row or row.xmin is None:
            logger.info("Nenhum imóvel encontrado para compor o BBox.")
            return

        bbox_coords = (row.xmin, row.ymin, row.xmax, row.ymax)
        
        try:
            from sentinelhub import CRS, BBox, DataCollection, MimeType, SentinelHubRequest
            from copernicus import _build_sh_config
        except ImportError as exc:
            logger.error(f"Dependencias ausentes: {exc}")
            return

        try:
            config = _build_sh_config()
        except ValueError as e:
            logger.error(str(e))
            return

        end_date = datetime.today()
        start_date = end_date - timedelta(days=60)
        time_interval = (start_date.strftime("%Y-%m-%d"), end_date.strftime("%Y-%m-%d"))

        sh_bbox = BBox(bbox=bbox_coords, crs=CRS.WGS84)
        s2l2a_cdse = DataCollection.SENTINEL2_L2A.define_from(
            name="S2L2A_CDSE",
            service_url=config.sh_base_url,
        )

        request = SentinelHubRequest(
            evalscript=EVALSCRIPT,
            input_data=[
                SentinelHubRequest.input_data(
                    data_collection=s2l2a_cdse,
                    time_interval=time_interval,
                    maxcc=0.2  # Baixa nuvem
                )
            ],
            responses=[SentinelHubRequest.output_response("default", MimeType.TIFF)],
            bbox=sh_bbox,
            resolution=10,
            config=config,
        )

        try:
            data = request.get_data()
            if not data:
                logger.warning("Nenhuma imagem Sentinel encontrada para o periodo com baixa nuvem.")
                return
            image = data[-1] # Pega a mais recente
        except Exception as e:
            logger.error(f"Erro ao baixar imagem: {e}")
            return

        b03 = image[:, :, 0]
        b04 = image[:, :, 1]
        b08 = image[:, :, 2]
        b11 = image[:, :, 3]
        dataMask = image[:, :, 4]

        # Evita divisão por zero
        np.seterr(divide='ignore', invalid='ignore')
        
        ndwi = np.where((b03 + b08) == 0., 0., (b03 - b08) / (b03 + b08))
        ndvi = np.where((b08 + b04) == 0., 0., (b08 - b04) / (b08 + b04))

        # Classificação baseada no MapBiomas
        class_mask = np.zeros(ndvi.shape, dtype=np.uint8)
        
        class_mask[ndwi > NDWI_WATER_THRESHOLD] = 1 # Corpos d'Água
        
        mask_veg = ndwi <= NDWI_WATER_THRESHOLD
        class_mask[mask_veg & (ndvi > NDVI_FOREST_THRESHOLD)] = 2 # Floresta Nativa
        class_mask[mask_veg & (ndvi > NDVI_PASTURE_CROP_THRESHOLD) & (ndvi <= NDVI_FOREST_THRESHOLD)] = 3 # Pastagem ou Lavoura
        class_mask[mask_veg & (ndvi <= NDVI_PASTURE_CROP_THRESHOLD)] = 4 # Solo Exposto
        
        class_mask[dataMask == 0] = 0

        class_names = {
            1: "Corpos d'Água",
            2: "Floresta Nativa",
            3: "Lavoura Temporária", # Simplificação para contemplar Lavoura/Pastagem
            4: "Solo Exposto"
        }

        height, width = class_mask.shape
        from rasterio.transform import from_bounds
        transform = from_bounds(*bbox_coords, width, height)

        imoveis = db_session.query(Imovel).filter(Imovel.municipio == municipio).all()

        try:
            for imovel in imoveis:
                geom_shapely = to_shape(imovel.poligono_declarado)
                
                shapes_gen = rasterio.features.shapes(class_mask, mask=(class_mask > 0), transform=transform)
                
                for geom, val in shapes_gen:
                    valor_classe = int(val)
                    nome_classe = class_names.get(valor_classe)
                    if not nome_classe:
                        continue
                    
                    poly_shapely = shape(geom)
                    
                    # Simplificar geometria levemente
                    poly_shapely = poly_shapely.simplify(0.0001, preserve_topology=True)
                    if not poly_shapely.is_valid:
                        poly_shapely = poly_shapely.buffer(0)
                    
                    # Recortar pelo perímetro do imóvel
                    intersection = poly_shapely.intersection(geom_shapely)
                    
                    if intersection.is_empty:
                        continue
                        
                    if intersection.geom_type == "Polygon":
                        intersection = MultiPolygon([intersection])
                    elif intersection.geom_type == "GeometryCollection":
                        polys = [g for g in intersection.geoms if g.geom_type in ("Polygon", "MultiPolygon")]
                        if not polys: continue
                        intersection = MultiPolygon(polys)
                    elif intersection.geom_type != "MultiPolygon":
                        continue

                    nova_cobertura = CoberturaObservada(
                        imovel_id=imovel.id,
                        classe=nome_classe,
                        area_hectares=0.0,
                        geometria=f"SRID=4326;{intersection.wkt}"
                    )
                    db_session.add(nova_cobertura)
            
            db_session.commit()
            logger.info(f"Processamento Sentinel-2 concluido para {municipio}.")
        except Exception as e:
            db_session.rollback()
            logger.error(f"Erro ao processar e inserir coberturas Sentinel-2: {e}")

