"""
Tupã — Adaptadores de exemplo (leem GeoJSON local).

Implementações concretas das interfaces definidas em sources/__init__.py.
Cada uma lê de tupa-back/data/exemplo/*.geojson.
"""
from __future__ import annotations

from pathlib import Path

import geopandas as gpd
from shapely.geometry.base import BaseGeometry

from sources import DeclaradoSource, DynamicWorldSource, SnifSource

DATA_DIR = Path(__file__).resolve().parent.parent / "data" / "exemplo"


def _read_geojson(filename: str) -> gpd.GeoDataFrame:
    path = DATA_DIR / filename
    if not path.exists():
        raise FileNotFoundError(f"Arquivo de exemplo não encontrado: {path}")
    gdf = gpd.read_file(path)
    if gdf.crs is None or str(gdf.crs) != "EPSG:4326":
        gdf = gdf.set_crs("EPSG:4326", allow_override=True)
    return gdf


class ExemploSnifSource(SnifSource):
    """Lê bases de referência de arquivos GeoJSON locais."""

    def get_vegetacao_nativa(self, bounds: BaseGeometry) -> gpd.GeoDataFrame:
        gdf = _read_geojson("vegetacao_nativa.geojson")
        return gdf[gdf.intersects(bounds)].copy()

    def get_hidrografia(self, bounds: BaseGeometry) -> gpd.GeoDataFrame:
        gdf = _read_geojson("hidrografia.geojson")
        return gdf[gdf.intersects(bounds)].copy()

    def get_app(self, bounds: BaseGeometry) -> gpd.GeoDataFrame:
        """
        Constrói a APP a partir do buffer de 30m da hidrografia.
        Na implementação real, viria pré-calculada do SNIF.
        """
        hidro = self.get_hidrografia(bounds)
        if hidro.empty:
            return gpd.GeoDataFrame(columns=["geometry"], geometry="geometry", crs="EPSG:4326")

        # Reprojetar para métrica (SIRGAS 2000 / Brazil Polyconic) para buffer em metros
        hidro_proj = hidro.to_crs("EPSG:5880")
        buffer_30m = hidro_proj.buffer(30)
        app_proj = gpd.GeoDataFrame(geometry=buffer_30m, crs="EPSG:5880")
        app = app_proj.to_crs("EPSG:4326")

        # Clipar pelo bounds do imóvel
        app["geometry"] = app.geometry.intersection(bounds)
        app = app[~app.geometry.is_empty].copy()
        return app

    def get_uso_restrito(self, bounds: BaseGeometry) -> gpd.GeoDataFrame:
        gdf = _read_geojson("uso_restrito.geojson")
        return gdf[gdf.intersects(bounds)].copy()


class ExemploDynamicWorldSource(DynamicWorldSource):
    """
    Lê uso e cobertura de GeoJSON local.

    Na implementação real, aqui entrará a consulta ao Google Earth Engine
    (Dynamic World) com credencial de service account.

    Ponto de extensão para GEE:
    -----------------------------------------------------------------------
    import ee
    ee.Initialize(credentials=service_account_credentials)
    dw = ee.ImageCollection("GOOGLE/DYNAMICWORLD/V1")
                .filterBounds(ee_geometry)
                .filterDate(start, end)
                .select("label")
                .mode()
    # Converter raster para vetorial e mapear classes
    -----------------------------------------------------------------------
    """

    def get_uso_cobertura(self, bounds: BaseGeometry) -> gpd.GeoDataFrame:
        gdf = _read_geojson("uso_cobertura.geojson")
        return gdf[gdf.intersects(bounds)].copy()


class ExemploDeclaradoSource(DeclaradoSource):
    """
    Lê o polígono declarado no CAR de GeoJSON local.

    Na implementação real, parsearia um arquivo .RET ou shapefile
    exportado do SICAR.
    """

    def get_declarado(self, imovel_id: str) -> gpd.GeoDataFrame:
        return _read_geojson("declarado_car.geojson")
