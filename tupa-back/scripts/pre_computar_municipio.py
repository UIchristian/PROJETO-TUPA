import sys
import logging
from pathlib import Path

# Adiciona tupa-back ao PYTHONPATH
sys.path.append(str(Path(__file__).resolve().parent.parent))

from db.database import SessionLocal, Base, engine, ensure_schema_upgrades
from sources.sentinel import SentinelSourceAdapter
from sources.mapbiomas import MapBiomasSourceAdapter
from sources.hidrografia import HidrografiaSourceAdapter
from sources.elevacao import ElevacaoSourceAdapter
from sources.declarado import DeclaradoSourceAdapter
from engine import calcular_diagnostico_postgis
from ogc.exporter import exportar_camadas_ogc

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def pre_computar(municipio: str):
    logger.info(f"Iniciando pré-computação para o município: {municipio}")
    
    # 1. Cria tabelas se não existirem
    Base.metadata.create_all(bind=engine)
    ensure_schema_upgrades()
    
    with SessionLocal() as db:
        # 2. Executa carga de dados através dos adaptadores
        # Declarado deve ser o primeiro: carrega os imóveis que os outros adapters precisam
        DeclaradoSourceAdapter().load_data(municipio, db)
        MapBiomasSourceAdapter().load_data(municipio, db)
        HidrografiaSourceAdapter().load_data(municipio, db)
        ElevacaoSourceAdapter().load_data(municipio, db)
        SentinelSourceAdapter().load_data(municipio, db)
        
        # 3. Busca todos os imóveis do município e roda o motor
        from db.models import Imovel
        imoveis = db.query(Imovel).filter(Imovel.municipio == municipio).all()
        
        logger.info(f"{len(imoveis)} imóveis encontrados para processamento.")
        for imovel in imoveis:
            calcular_diagnostico_postgis(imovel.id, db)
            
        # 4. Exporta para OGC
        out_dir = Path(__file__).resolve().parent.parent / "data" / municipio / "output"
        exportar_camadas_ogc(municipio, db, out_dir)
        
        logger.info(f"Pré-computação do município {municipio} concluída com sucesso!")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Uso: python pre_computar_municipio.py <nome_municipio>")
        sys.exit(1)
        
    pre_computar(sys.argv[1])
