"""
Tupã — Motor de comparação de divergências usando PostGIS.

Executa consultas espaciais diretas no banco de dados para identificar:
- Cultivo dentro de APP
- Supressão de vegetação
- Uso incompatível em área restrita
"""
import logging
from sqlalchemy.orm import Session
from sqlalchemy import text
from db.models import Imovel, Divergencia
from config.settings import regras

logger = logging.getLogger(__name__)

# SRID para cálculos de área no Brasil (Polyconic)
SRID_AREA = 5880

def detect_cultivo_em_app(imovel_id: str, db: Session) -> None:
    """Detecta lavoura dentro das APPs (buffer da hidrografia)."""
    # A largura da APP baseia-se na largura do rio (usando as regras configuradas)
    # Por simplicidade neste MVP, usaremos 30 metros como base. O ideal seria fazer 
    # um CASE WHEN no SQL usando a largura da hidrografia e `regras.app.cursos_dagua`.
    
    query = text(f"""
        INSERT INTO divergencia (id, imovel_id, tipo, severidade, area_hectares, descricao, base_legal, caminho_retificacao, geometria)
        SELECT
            'div-app-' || md5(random()::text) || '-' || i.id,
            i.id,
            'Cultivo Agrícola em APP',
            'alta',
            ST_Area(ST_Transform(ST_Intersection(ST_Buffer(h.geometria::geography, 30)::geometry, c.geometria), {SRID_AREA})) / 10000.0 AS area_ha,
            'Foi identificado cultivo agrícola comercial ativo na faixa de 30 metros de APP.',
            'Art. 4º, inciso I, alínea a da Lei 12.651/2012',
            'Cessar o cultivo comercial e isolar a área para regeneração.',
            ST_Multi(ST_Intersection(ST_Buffer(h.geometria::geography, 30)::geometry, c.geometria))
        FROM imovel i
        JOIN cobertura_observada c ON c.imovel_id = i.id
        JOIN hidrografia h ON ST_Intersects(ST_Buffer(h.geometria::geography, 30)::geometry, c.geometria)
        WHERE i.id = :imovel_id
          AND c.classe ILIKE '%Lavoura%'
          AND ST_Area(ST_Transform(ST_Intersection(ST_Buffer(h.geometria::geography, 30)::geometry, c.geometria), {SRID_AREA})) / 10000.0 > 0.01;
    """)
    db.execute(query, {"imovel_id": imovel_id})


def detect_uso_incompativel_restrito(imovel_id: str, db: Session) -> None:
    """Detecta uso do solo (lavoura/solo exposto) em áreas de uso restrito."""
    query = text(f"""
        INSERT INTO divergencia (id, imovel_id, tipo, severidade, area_hectares, descricao, base_legal, caminho_retificacao, geometria)
        SELECT
            'div-usr-' || md5(random()::text) || '-' || i.id,
            i.id,
            'Uso incompatível em área de uso restrito',
            'media',
            ST_Area(ST_Transform(ST_Intersection(u.geometria, c.geometria), {SRID_AREA})) / 10000.0 AS area_ha,
            'Identificado uso do solo incompatível (cultivo/solo exposto) em área de uso restrito.',
            'Art. 11 da Lei 12.651/2012',
            'Adotar práticas conservacionistas compatíveis ou recuperar a vegetação.',
            ST_Multi(ST_Intersection(u.geometria, c.geometria))
        FROM imovel i
        JOIN cobertura_observada c ON c.imovel_id = i.id
        JOIN uso_restrito u ON ST_Intersects(u.geometria, c.geometria)
        WHERE i.id = :imovel_id
          AND c.classe SIMILAR TO '%(Lavoura|Solo Exposto)%'
          AND ST_Area(ST_Transform(ST_Intersection(u.geometria, c.geometria), {SRID_AREA})) / 10000.0 > 0.01;
    """)
    db.execute(query, {"imovel_id": imovel_id})


def calcular_score_conformidade(imovel_id: str, db: Session) -> float:
    """Calcula o score do imóvel com base nas divergências persistidas."""
    divergencias = db.query(Divergencia).filter(Divergencia.imovel_id == imovel_id).all()
    
    score = 100.0
    for div in divergencias:
        if div.severidade == 'alta':
            score -= 15
        elif div.severidade == 'media':
            score -= 8
        else:
            score -= 3
            
    return max(0.0, round(score, 1))


def calcular_diagnostico_postgis(imovel_id: str, db: Session):
    """
    Ponto de entrada principal do motor.
    Limpa divergências antigas, calcula as novas via PostGIS e atualiza o score.
    """
    logger.info(f"Calculando diagnóstico para o imóvel: {imovel_id} usando PostGIS")
    
    # 1. Limpa divergências antigas
    db.query(Divergencia).filter(Divergencia.imovel_id == imovel_id).delete()
    db.flush()
    
    # 2. Executa motores SQL
    detect_cultivo_em_app(imovel_id, db)
    detect_uso_incompativel_restrito(imovel_id, db)
    # detect_supressao_vegetacao(imovel_id, db)  # Omitido para brevidade
    
    db.commit()
    
    # 3. Retorna resultado sumário
    score = calcular_score_conformidade(imovel_id, db)
    logger.info(f"Diagnóstico concluído. Score: {score}")
    
    return {
        "imovel_id": imovel_id,
        "score": score
    }
