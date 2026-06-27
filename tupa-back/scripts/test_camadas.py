"""Test script: run the exact same SQL as the camadas endpoint."""
import sys, json
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from db.database import SessionLocal
from sqlalchemy import text

with SessionLocal() as db:
    raw = db.execute(text("""
        SELECT json_build_object(
            'type', 'FeatureCollection',
            'features', COALESCE(
                json_agg(
                    json_build_object(
                        'type', 'Feature',
                        'geometry', ST_AsGeoJSON(geometria)::json,
                        'properties', json_build_object(
                            'id',            id,
                            'imovel_id',     imovel_id,
                            'subclasse',     subclasse,
                            'base_legal',    base_legal,
                            'area_hectares', area_hectares,
                            'confianca',     confianca
                        )
                    )
                ),
                '[]'::json
            )
        )::text AS json
        FROM feicao_referencia
        WHERE municipio = :mun AND tipo = :tipo AND geometria IS NOT NULL
    """), {'mun': 'Capim Branco', 'tipo': 'APP_CURSO_DAGUA'}).scalar()

    d = json.loads(raw)
    print('features:', len(d['features']))
    print('props:', d['features'][0]['properties'])
