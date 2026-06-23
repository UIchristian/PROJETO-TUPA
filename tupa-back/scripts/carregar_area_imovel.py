"""
Carrega todos os imóveis do shapefile AREA_IMOVEL/AREA_IMOVEL_1.shp
para a tabela `imovel` no PostGIS.

Usa ON CONFLICT DO NOTHING para não sobrescrever imóveis que já têm
dados de cobertura pré-computados (ex: Fervedouro).

Uso:
    cd tupa-back
    python scripts/carregar_area_imovel.py
"""

import sys
import time
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parent.parent))

import geopandas as gpd
from shapely.geometry import MultiPolygon
from sqlalchemy import create_engine, text

from db.database import DATABASE_URL

SHAPEFILE = Path(__file__).resolve().parent.parent / "AREA_IMOVEL" / "AREA_IMOVEL_1.shp"
CHUNK_SIZE = 5_000


def ensure_multipolygon(geom):
    if geom is None:
        return None
    if geom.geom_type == "Polygon":
        return MultiPolygon([geom])
    return geom


def main():
    if not SHAPEFILE.exists():
        print(f"[ERRO] Shapefile não encontrado: {SHAPEFILE}")
        sys.exit(1)

    engine = create_engine(DATABASE_URL, echo=False)

    print(f"Lendo {SHAPEFILE.name} ...")
    t0 = time.time()
    gdf = gpd.read_file(SHAPEFILE)
    print(f"  {len(gdf):,} registros lidos em {time.time()-t0:.1f}s")

    print("Reprojetando para EPSG:4326 ...")
    if gdf.crs is None or gdf.crs.to_epsg() != 4326:
        gdf = gdf.to_crs("EPSG:4326")

    print("Convertendo geometrias para MultiPolygon ...")
    gdf["geometry"] = gdf["geometry"].apply(ensure_multipolygon)

    total = len(gdf)
    inserted = 0
    skipped = 0

    print(f"Inserindo em lotes de {CHUNK_SIZE:,} registros ...")
    with engine.connect() as conn:
        for start in range(0, total, CHUNK_SIZE):
            chunk = gdf.iloc[start : start + CHUNK_SIZE]

            rows = []
            for _, row in chunk.iterrows():
                cod = row.get("cod_imovel")
                if not cod:
                    continue
                cod = str(cod)
                geom = row.geometry
                wkt = f"SRID=4326;{geom.wkt}" if geom else None
                municipio = str(row.get("municipio", "")).lower()
                uf = cod[:2] if len(cod) >= 2 else "XX"
                rows.append(
                    {
                        "id": f"imovel_{cod}",
                        "nome": cod,
                        "municipio": municipio,
                        "uf": uf,
                        "numero_car": cod,
                        "poligono": wkt,
                    }
                )

            if not rows:
                continue

            result = conn.execute(
                text(
                    """
                    INSERT INTO imovel (id, nome, municipio, uf, numero_car, poligono_declarado)
                    VALUES (:id, :nome, :municipio, :uf, :numero_car, ST_GeomFromEWKT(:poligono))
                    ON CONFLICT (id) DO NOTHING
                    """
                ),
                rows,
            )
            conn.commit()

            batch_inserted = result.rowcount
            batch_skipped = len(rows) - batch_inserted
            inserted += batch_inserted
            skipped += batch_skipped

            end = min(start + CHUNK_SIZE, total)
            pct = end / total * 100
            print(f"  {end:>9,}/{total:,}  ({pct:5.1f}%)  inseridos={inserted:,}  já existiam={skipped:,}")

    print(f"\nConcluído! Total inserido: {inserted:,} | Já existiam: {skipped:,}")


if __name__ == "__main__":
    main()
