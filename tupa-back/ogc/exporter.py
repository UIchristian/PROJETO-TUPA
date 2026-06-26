import logging
import subprocess
import os
from pathlib import Path
from sqlalchemy.orm import Session
from sqlalchemy import text

logger = logging.getLogger(__name__)

# Tipos de feição a expor como views WMS/WFS
_TIPOS_FEICAO = [
    "APP_CURSO_DAGUA",
    "APP_NASCENTE",
    "APP_LAGO",
    "APP_VEREDA",
    "USO_RESTRITO_ENCOSTA",
    "RESERVA_LEGAL_PROPOSTA",
    "COBERTURA",
]


def exportar_camadas_ogc(municipio: str, db: Session, output_dir: Path):
    """Exporta as camadas do município para GeoPackage e cria views WMS/WFS."""
    output_dir.mkdir(parents=True, exist_ok=True)

    _criar_views_postgis(municipio, db)
    _exportar_geopackage(municipio, output_dir)


def _criar_views_postgis(municipio: str, db: Session):
    """Cria ou atualiza views por tipo de feição — base para GeoServer WMS/WFS."""
    for tipo in _TIPOS_FEICAO:
        view_name = f"wms_{tipo.lower()}"
        try:
            db.execute(text(f"DROP VIEW IF EXISTS {view_name} CASCADE;"))
            db.execute(text(f"""
                CREATE VIEW {view_name} AS
                SELECT id, municipio, imovel_id, subclasse, base_legal,
                       confianca, area_hectares, geometria
                FROM feicao_referencia
                WHERE tipo = '{tipo}';
            """))
        except Exception as e:
            logger.warning(f"Não foi possível criar view {view_name}: {e}")
            db.rollback()
            continue

    # View legada de divergências (mantida para compatibilidade)
    try:
        db.execute(text("DROP VIEW IF EXISTS wms_divergencias CASCADE;"))
        db.execute(text("""
            CREATE VIEW wms_divergencias AS
            SELECT id, imovel_id, tipo, severidade, area_hectares, geometria
            FROM divergencia;
        """))
    except Exception as e:
        logger.warning(f"Não foi possível criar view wms_divergencias: {e}")
        db.rollback()
        return

    db.commit()
    logger.info(f"Views OGC criadas/atualizadas para {municipio}.")


def _exportar_geopackage(municipio: str, output_dir: Path):
    """Exporta feicao_referencia para GeoPackage via ogr2ogr (requer GDAL).

    Se o GDAL não estiver instalado, registra aviso e pula a exportação.
    O GeoPackage pode ser aberto diretamente no QGIS ou enviado ao SICAR.
    """
    pg_dsn = os.environ.get("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/tupa")

    # DATABASE_URL pode ser SQLAlchemy-style; ogr2ogr usa DSN Postgres puro
    if pg_dsn.startswith("postgresql+"):
        pg_dsn = pg_dsn.replace("postgresql+psycopg2://", "postgresql://", 1)
        pg_dsn = pg_dsn.replace("postgresql+psycopg://", "postgresql://", 1)

    gpkg = output_dir / f"base_referencia_{municipio}.gpkg"
    sql = f"SELECT * FROM feicao_referencia WHERE municipio = '{municipio}'"

    try:
        subprocess.run(
            [
                "ogr2ogr",
                "-f", "GPKG",
                str(gpkg),
                f"PG:{pg_dsn}",
                "-sql", sql,
                "-nln", "feicao_referencia",
                "-overwrite",
            ],
            check=True,
            capture_output=True,
            text=True,
        )
        logger.info(f"GeoPackage exportado: {gpkg}")
    except FileNotFoundError:
        logger.warning(
            "ogr2ogr não encontrado. Instale o GDAL para habilitar exportação de GeoPackage. "
            "As views PostGIS foram criadas e podem ser usadas diretamente pelo GeoServer."
        )
    except subprocess.CalledProcessError as e:
        logger.error(f"Erro ao exportar GeoPackage: {e.stderr}")
