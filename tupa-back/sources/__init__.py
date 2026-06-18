"""
Tupã — Interfaces (ABCs) para adaptadores de fontes de dados.

Cada adaptador implementa uma dessas interfaces. Hoje leem dados de
exemplo de arquivos locais; amanhã recebem credenciais e conectam com
as fontes reais (SNIF, Google Earth Engine, SICAR).
"""
from __future__ import annotations

from abc import ABC, abstractmethod

import geopandas as gpd
from shapely.geometry.base import BaseGeometry


class SnifSource(ABC):
    """
    Bases de referência oficiais (SNIF/IBGE/ANA):
    vegetação nativa, hidrografia, APP e uso restrito.
    """

    @abstractmethod
    def get_vegetacao_nativa(self, bounds: BaseGeometry) -> gpd.GeoDataFrame:
        """Retorna manchas de vegetação nativa dentro do bounds."""

    @abstractmethod
    def get_hidrografia(self, bounds: BaseGeometry) -> gpd.GeoDataFrame:
        """Retorna cursos d'água (LineString/MultiLineString) dentro do bounds."""

    @abstractmethod
    def get_app(self, bounds: BaseGeometry) -> gpd.GeoDataFrame:
        """
        Retorna a faixa de APP (Área de Preservação Permanente).
        Tipicamente buffer de 30m ao redor da hidrografia, clippado pelo bounds.
        """

    @abstractmethod
    def get_uso_restrito(self, bounds: BaseGeometry) -> gpd.GeoDataFrame:
        """Retorna áreas de uso restrito (encostas, topos de morro) dentro do bounds."""


class DynamicWorldSource(ABC):
    """
    Atualização de uso e cobertura do solo por satélite.
    Na implementação real, consulta o Google Earth Engine (Dynamic World).
    """

    @abstractmethod
    def get_uso_cobertura(self, bounds: BaseGeometry) -> gpd.GeoDataFrame:
        """
        Retorna FeatureCollection com classes de uso e cobertura do solo.
        Cada feature tem atributo 'classe' (ex: 'Lavoura', 'Pastagem', 'Floresta Nativa').
        """


class DeclaradoSource(ABC):
    """
    O que foi declarado no CAR (Cadastro Ambiental Rural).
    Pode vir de um arquivo .RET, shapefile ou GeoJSON.
    """

    @abstractmethod
    def get_declarado(self, imovel_id: str) -> gpd.GeoDataFrame:
        """
        Retorna o polígono declarado no CAR para o imóvel.
        O GeoDataFrame deve ter coluna 'geometry' com o polígono.
        """
