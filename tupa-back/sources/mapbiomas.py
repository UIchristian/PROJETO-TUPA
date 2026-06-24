import logging
from pathlib import Path
from sqlalchemy.orm import Session
from geoalchemy2.shape import to_shape
from shapely.geometry import shape, MultiPolygon
import rasterio
import rasterio.mask
import rasterio.features
from db.models import Imovel, CoberturaObservada
from . import BaseSourceAdapter

logger = logging.getLogger(__name__)

# Dicionário de conversão simplificado das classes do MapBiomas (Coleção 8+)
# Para as classes do Tupã. No mundo real, mapearíamos todos os IDs (ex: 3=Floresta, 15=Pastagem, 39=Soja)
MAPBIOMAS_CLASSES = {
    3: "Floresta Nativa",
    4: "Formação Savânica",
    15: "Pastagem",
    39: "Lavoura Temporária",
    41: "Outras Lavouras",
    33: "Corpos d'Água",
    24: "Infraestrutura Urbana",
}

class MapBiomasSourceAdapter(BaseSourceAdapter):
    """Lê a cobertura do MapBiomas e carrega no banco PostGIS (tabela cobertura_observada)."""

    def load_data(self, municipio: str, db_session: Session):
        logger.info(f"Carregando cobertura do solo do MapBiomas para {municipio}...")
        
        # O arquivo esperado é um raster TIF do MapBiomas para o município
        raster_path = Path("data") / municipio / "mapbiomas.tif"
        
        if not raster_path.exists():
            logger.warning(f"Arquivo raster não encontrado: {raster_path}. Pulo da ingestão.")
            return

        # 1. Buscar todos os imóveis do município
        imoveis = db_session.query(Imovel).filter(Imovel.municipio == municipio).all()
        if not imoveis:
            logger.info("Nenhum imóvel encontrado para este município.")
            return
            
        with rasterio.open(raster_path) as src:
            for imovel in imoveis:
                try:
                    # Deletar coberturas antigas deste imóvel — apenas as desta fonte,
                    # para não apagar a camada recente do Sentinel (que coexiste).
                    db_session.query(CoberturaObservada).filter(
                        CoberturaObservada.imovel_id == imovel.id,
                        (CoberturaObservada.fonte == "mapbiomas")
                        | (CoberturaObservada.fonte.is_(None)),
                    ).delete(synchronize_session=False)
                    
                    # Extrair a geometria do imóvel do PostGIS (em WKB -> Shapely)
                    geom_shapely = to_shape(imovel.poligono_declarado)
                    
                    # Rasterio aceita geometrias no formato GeoJSON-like dict
                    geom_geojson = [geom_shapely.__geo_interface__]
                    
                    # 2. Recortar o raster para a área do imóvel (mask)
                    out_image, out_transform = rasterio.mask.mask(src, geom_geojson, crop=True)
                    out_image = out_image[0] # Pegar a primeira banda
                    
                    # 3. Vetorizar as classes recortadas
                    # rasterio.features.shapes retorna pares (geometria_geojson, valor_pixel)
                    shapes_gen = rasterio.features.shapes(out_image, transform=out_transform)
                    
                    # Para não inserir ruídos de NoData ou classe 0
                    for geom, value in shapes_gen:
                        valor_classe = int(value)
                        if valor_classe == 0:
                            continue
                            
                        nome_classe = MAPBIOMAS_CLASSES.get(valor_classe, f"Outros ({valor_classe})")
                        poly_shapely = shape(geom)
                        if poly_shapely.geom_type == "Polygon":
                            poly_shapely = MultiPolygon([poly_shapely])

                        # Inserir a nova cobertura no banco
                        nova_cobertura = CoberturaObservada(
                            imovel_id=imovel.id,
                            classe=nome_classe,
                            # A área real precisaria do ST_Area no SRID correto,
                            # mas podemos deixar nulo ou estimar para preenchimento via DB trigger
                            area_hectares=0.0,
                            fonte="mapbiomas",
                            geometria=f"SRID=4326;{poly_shapely.wkt}"
                        )
                        db_session.add(nova_cobertura)
                        
                    db_session.commit()
                    logger.info(f"Cobertura processada para o imóvel {imovel.id}.")
                    
                except Exception as e:
                    db_session.rollback()
                    logger.error(f"Erro ao processar raster para o imóvel {imovel.id}: {e}")
