import logging
from sqlalchemy.orm import Session
from . import BaseSourceAdapter

logger = logging.getLogger(__name__)

class HidrografiaSourceAdapter(BaseSourceAdapter):
    """Carrega dados da rede de drenagem (ANA/IBGE)."""

    def load_data(self, municipio: str, db_session: Session):
        logger.info(f"Carregando hidrografia (rede de drenagem) para {municipio}...")
        # Lógica de carga para a tabela PostGIS "hidrografia" local
        pass
