import os
import logging
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base

logger = logging.getLogger(__name__)

# Default to a local PostGIS instance if not provided
DATABASE_URL = os.getenv(
    "DATABASE_URL", 
    "postgresql://postgres:password@localhost:5432/tupa_db"
)

engine = create_engine(DATABASE_URL, echo=False)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def ensure_schema_upgrades():
    """
    Aplica upgrades idempotentes de schema que o `create_all` não cobre
    (ele cria tabelas novas, mas não altera tabelas já existentes).

    Necessário para bancos que já tinham `cobertura_observada` antes da
    introdução da coluna `fonte` (ex: município pré-computado). O DEFAULT
    faz o backfill das linhas existentes como 'mapbiomas'.
    """
    try:
        with engine.begin() as conn:
            conn.execute(text(
                "ALTER TABLE cobertura_observada "
                "ADD COLUMN IF NOT EXISTS fonte VARCHAR DEFAULT 'mapbiomas'"
            ))
    except Exception as exc:
        logger.warning(f"Não foi possível aplicar upgrades de schema: {exc}")
