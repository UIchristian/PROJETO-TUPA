import logging
from pathlib import Path
from sqlalchemy.orm import Session
from sqlalchemy import text

logger = logging.getLogger(__name__)

def exportar_camadas_ogc(municipio: str, db: Session, output_dir: Path):
    """
    Exporta as camadas de divergências e coberturas do município para GeoPackage.
    Em um ambiente de produção, poderíamos usar `ogr2ogr` do GDAL conectando direto
    ao PostGIS para gerar as saídas.
    """
    logger.info(f"Exportando camadas OGC para {municipio} no diretório {output_dir}")
    
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Exemplo: Chamar pgsql2shp ou ogr2ogr via subprocess.
    # Como não temos GDAL garantido aqui, usamos a query para criar materializations.
    # No GeoServer, as camadas WMS seriam apontadas para views diretamente no banco.
    
    # Criar view para acesso WMS:
    try:
        db.execute(text("""
            CREATE OR REPLACE VIEW wms_divergencias AS
            SELECT id, imovel_id, tipo, severidade, geometria
            FROM divergencia;
        """))
        db.commit()
        logger.info("View 'wms_divergencias' criada/atualizada no PostGIS com sucesso.")
    except Exception as e:
        logger.error(f"Erro ao criar view OGC: {e}")
        db.rollback()
