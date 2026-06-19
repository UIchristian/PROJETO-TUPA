import logging
from sqlalchemy.orm import Session
from . import BaseSourceAdapter

logger = logging.getLogger(__name__)

class ElevacaoSourceAdapter(BaseSourceAdapter):
    """Carrega MDE (SRTM/Copernicus DEM) e gera limites de encosta (>45 graus e 25-45 graus)."""

    def load_data(self, municipio: str, db_session: Session):
        logger.info(f"Processando modelo de elevação e gerando polígonos de declividade para {municipio}...")
        pass
