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
    poligono_declarado = Column(Geometry(geometry_type='MULTIPOLYGON', srid=4326))

    divergencias = relationship("Divergencia", back_populates="imovel", cascade="all, delete-orphan")
    coberturas = relationship("CoberturaObservada", back_populates="imovel", cascade="all, delete-orphan")
    feicoes_referencia = relationship("FeicaoReferencia", back_populates="imovel", cascade="all, delete-orphan")


class CoberturaObservada(Base):
    __tablename__ = "cobertura_observada"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    imovel_id = Column(String, ForeignKey("imovel.id"))
    classe = Column(String)
    area_hectares = Column(Float)
    geometria = Column(Geometry(geometry_type='MULTIPOLYGON', srid=4326))

    imovel = relationship("Imovel", back_populates="coberturas")


class Divergencia(Base):
    __tablename__ = "divergencia"

    id = Column(String, primary_key=True, index=True)
    imovel_id = Column(String, ForeignKey("imovel.id"))
    tipo = Column(String)
    severidade = Column(String)  # alta, media, baixa
    area_hectares = Column(Float)
    descricao = Column(String)
    base_legal = Column(String)
    caminho_retificacao = Column(String)
    geometria = Column(Geometry(geometry_type='MULTIPOLYGON', srid=4326))

    imovel = relationship("Imovel", back_populates="divergencias")


class Hidrografia(Base):
    __tablename__ = "hidrografia"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    municipio = Column(String)
    tipo = Column(String)  # rio, lago, nascente, vereda
    largura = Column(Float)  # metros; NULL → aplica piso de 30m (conservador)
    geometria = Column(Geometry(geometry_type='GEOMETRY', srid=4326))


class UsoRestrito(Base):
    __tablename__ = "uso_restrito"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    municipio = Column(String)
    tipo = Column(String)  # encosta_25_45, encosta_acima_45
    geometria = Column(Geometry(geometry_type='MULTIPOLYGON', srid=4326))


class FeicaoReferencia(Base):
    """Feições de referência SICAR-ready geradas pelo motor Tupã.

    Espelha a taxonomia do SICAR. Esta é a saída principal do sistema:
    uma base vetorizada e exportável em padrão OGC para municípios que
    não possuem base de referência.
    """
    __tablename__ = "feicao_referencia"

    id = Column(Integer, primary_key=True, autoincrement=True)
    municipio = Column(String, index=True)
    imovel_id = Column(String, ForeignKey("imovel.id"), nullable=True)
    # APP_CURSO_DAGUA | APP_NASCENTE | APP_LAGO | APP_VEREDA |
    # USO_RESTRITO_ENCOSTA | RESERVA_LEGAL_PROPOSTA | COBERTURA
    tipo = Column(String)
    subclasse = Column(String)   # classe de cobertura ou enquadramento da RL
    base_legal = Column(String)  # ex: "Art. 4, I, Lei 12.651/2012"
    area_hectares = Column(Float)
    confianca = Column(String)   # alta | media | baixa
    geometria = Column(Geometry(geometry_type='MULTIPOLYGON', srid=4326))

    imovel = relationship("Imovel", back_populates="feicoes_referencia")
