import sys
import logging
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parent.parent))

from db.database import SessionLocal, Base, engine
from sources.sentinel import SentinelSourceAdapter
from sources.mapbiomas import MapBiomasSourceAdapter
from sources.hidrografia import HidrografiaSourceAdapter
from sources.elevacao import ElevacaoSourceAdapter
from sources.declarado import DeclaradoSourceAdapter
from engine import calcular_diagnostico_postgis
from gerar_base_referencia import gerar_base_municipio
from ogc.exporter import exportar_camadas_ogc

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def pre_computar(municipio: str):
    logger.info(f"Iniciando pré-computação para o município: {municipio}")

    Base.metadata.create_all(bind=engine)

    with SessionLocal() as db:
        # 1. Carga de dados (declarado deve ser o primeiro)
        DeclaradoSourceAdapter().load_data(municipio, db)
        MapBiomasSourceAdapter().load_data(municipio, db)
        HidrografiaSourceAdapter().load_data(municipio, db)
        ElevacaoSourceAdapter().load_data(municipio, db)
        SentinelSourceAdapter().load_data(municipio, db)

        # 2. Motor de divergências por imóvel
        from db.models import Imovel
        imoveis = db.query(Imovel).filter(Imovel.municipio == municipio).all()
        logger.info(f"{len(imoveis)} imóveis encontrados para processamento.")
        for imovel in imoveis:
            calcular_diagnostico_postgis(imovel.id, db)

        # 3. Geração da base de referência SICAR-ready
        resumo = gerar_base_municipio(municipio, db)
        logger.info(f"Base de referência: {resumo}")

        # 4. Exportação OGC (GeoPackage + views PostGIS)
        out_dir = Path(__file__).resolve().parent.parent / "data" / municipio / "output"
        exportar_camadas_ogc(municipio, db, out_dir)

        logger.info(f"Pré-computação do município {municipio} concluída!")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Uso: python pre_computar_municipio.py <nome_municipio>")
        sys.exit(1)

    pre_computar(sys.argv[1])
