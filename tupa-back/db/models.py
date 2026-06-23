from sqlalchemy import Column, Integer, String, Float, ForeignKey
from sqlalchemy.orm import relationship
from geoalchemy2 import Geometry
from .database import Base

class Imovel(Base):
    __tablename__ = "imovel"

    id = Column(String, primary_key=True, index=True)
    nome = Column(String)
    municipio = Column(String)
    uf = Column(String)
    numero_car = Column(String, unique=True, index=True)
    
    # Using SRID 4326 for storage, will reproject to 5880 for area calculations
    poligono_declarado = Column(Geometry(geometry_type='MULTIPOLYGON', srid=4326))

    # Relationships
    divergencias = relationship("Divergencia", back_populates="imovel", cascade="all, delete-orphan")
    coberturas = relationship("CoberturaObservada", back_populates="imovel", cascade="all, delete-orphan")


class CoberturaObservada(Base):
    """Armazena a cobertura do solo observada por imóvel."""
    __tablename__ = "cobertura_observada"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    imovel_id = Column(String, ForeignKey("imovel.id"))
    classe = Column(String) # Ex: "Floresta Nativa", "Lavoura"
    area_hectares = Column(Float)
    geometria = Column(Geometry(geometry_type='MULTIPOLYGON', srid=4326))

    imovel = relationship("Imovel", back_populates="coberturas")


class Divergencia(Base):
    """Armazena as divergências encontradas pelo motor."""
    __tablename__ = "divergencia"

    id = Column(String, primary_key=True, index=True)
    imovel_id = Column(String, ForeignKey("imovel.id"))
    tipo = Column(String) # CULTIVO_EM_APP, SUPRESSAO_VEGETACAO, etc.
    severidade = Column(String) # alta, media, baixa
    area_hectares = Column(Float)
    descricao = Column(String)
    base_legal = Column(String)
    caminho_retificacao = Column(String)
    geometria = Column(Geometry(geometry_type='MULTIPOLYGON', srid=4326))

    imovel = relationship("Imovel", back_populates="divergencias")


class Hidrografia(Base):
    """Armazena a rede de drenagem."""
    __tablename__ = "hidrografia"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    municipio = Column(String)
    tipo = Column(String) # rio, lago, nascente
    largura = Column(Float) # usado para calcular a faixa de APP
    geometria = Column(Geometry(geometry_type='GEOMETRY', srid=4326))


class UsoRestrito(Base):
    """Armazena áreas de uso restrito (declividade entre 25 e 45 graus, pantanais, etc)."""
    __tablename__ = "uso_restrito"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    municipio = Column(String)
    tipo = Column(String)
    geometria = Column(Geometry(geometry_type='MULTIPOLYGON', srid=4326))

