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
BASE_DIR = Path(__file__).resolve().parent.parent

# Mapeamento MapBiomas 2024 (Coleção 9) → classe interna do Tupã
# As classes internas são as que o engine.py e gerar_base_referencia.py referenciam.
MAPBIOMAS_CLASSES = {
    # Formações florestais → Floresta Nativa (conta para Reserva Legal)
    1:  "Floresta Nativa",
    3:  "Floresta Nativa",   # Formação Florestal
    4:  "Formação Savânica", # Savana (Cerrado arbóreo) — conta para RL
    5:  "Floresta Nativa",   # Mangue
    6:  "Floresta Nativa",   # Floresta Alagável
    49: "Floresta Nativa",   # Restinga Arbórea

    # Formações naturais não florestais
    10: "Formação Campestre",
    11: "Campo Alagado",
    12: "Formação Campestre",
    29: "Afloramento Rochoso",
    32: "Apicum",
    50: "Formação Campestre", # Restinga Herbácea

    # Agropecuária
    14: "Mosaico Agropecuário",
    15: "Pastagem",
    18: "Lavoura Temporária",
    19: "Lavoura Permanente",
    20: "Lavoura Temporária",  # Cana
    21: "Mosaico Agropecuário",
    36: "Lavoura Temporária",  # Outras Lavouras Temporárias
    39: "Lavoura Temporária",  # Soja
    40: "Lavoura Temporária",  # Arroz
    41: "Lavoura Temporária",  # Outras Lavouras
    46: "Lavoura Permanente",  # Café
    47: "Lavoura Permanente",  # Citrus
    48: "Lavoura Permanente",  # Outras Permanentes
    62: "Lavoura Temporária",  # Algodão
    9:  "Silvicultura",

    # Área não vegetada
    22: "Solo Exposto",
    23: "Solo Exposto",  # Praia e Duna
    24: "Área Urbanizada",
    25: "Solo Exposto",  # Outras Áreas não Vegetadas
    30: "Mineração",

    # Corpos d'água
    26: "Corpos d'Água",
    31: "Corpos d'Água",  # Aquicultura
    33: "Corpos d'Água",  # Rio, Lago e Oceano

    # Não observado / sem dado
    27: "Não Observado",
    0:  "Não Observado",
}


class MapBiomasSourceAdapter(BaseSourceAdapter):
    """Lê a cobertura do MapBiomas e carrega no banco PostGIS (tabela cobertura_observada)."""

    def load_data(self, municipio: str, db_session: Session):
        logger.info(f"Carregando cobertura do solo (MapBiomas) para {municipio}...")

        raster_path = BASE_DIR / "data" / municipio / "mapbiomas.tif"
        if not raster_path.exists():
            logger.warning(f"Raster não encontrado: {raster_path}. Pulando.")
            return

        imoveis = db_session.query(Imovel).filter(Imovel.municipio == municipio).all()
        if not imoveis:
            logger.info("Nenhum imóvel encontrado para este município.")
            return

        processados = 0
        erros = 0

        with rasterio.open(raster_path) as src:
            for imovel in imoveis:
                try:
                    db_session.query(CoberturaObservada)\
                        .filter(CoberturaObservada.imovel_id == imovel.id).delete()

                    geom_shapely  = to_shape(imovel.poligono_declarado)
                    geom_geojson  = [geom_shapely.__geo_interface__]

                    out_image, out_transform = rasterio.mask.mask(
                        src, geom_geojson, crop=True, nodata=0)
                    banda = out_image[0]

                    for geom_dict, valor in rasterio.features.shapes(
                            banda, mask=(banda > 0), transform=out_transform):

                        classe_id = int(valor)
                        nome = MAPBIOMAS_CLASSES.get(classe_id, f"Outros ({classe_id})")
                        if nome == "Não Observado":
                            continue

                        poly = shape(geom_dict)
                        if poly.is_empty or poly.area < 1e-10:
                            continue
                        if poly.geom_type == "Polygon":
                            poly = MultiPolygon([poly])

                        db_session.add(CoberturaObservada(
                            imovel_id=imovel.id,
                            classe=nome,
                            area_hectares=0.0,  # calculado via ST_Area no diagnóstico
                            geometria=f"SRID=4326;{poly.wkt}"
                        ))

                    db_session.commit()
                    processados += 1

                except Exception as e:
                    db_session.rollback()
                    logger.error(f"Erro no imóvel {imovel.id}: {e}")
                    erros += 1

        logger.info(f"MapBiomas carregado: {processados} imóveis OK, {erros} erros.")
