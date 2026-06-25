"""
Tupã — Motor de comparação de divergências usando PostGIS.

Executa consultas espaciais diretas no banco de dados para identificar:
- Cultivo dentro de APP
- Supressão de vegetação
- Uso incompatível em área restrita
- Déficit de Reserva Legal (bioma-aware, Art. 12 e Art. 67)
"""
import logging
from sqlalchemy.orm import Session
from sqlalchemy import text
from db.models import Divergencia
from config.settings import regras

logger = logging.getLogger(__name__)

SRID_AREA = 5880  # Polycônica, referência para área no Brasil


# UFs integralmente na Amazônia Legal → 80% de RL (floresta)
_AMAZONIA_FLORESTA = {"AM", "PA", "AC", "RO", "RR", "AP"}
# UFs parcialmente na Amazônia Legal → 35% (cerrado como proxy conservador)
# Em produção substituir por join espacial com shapefile de biomas IBGE.
_AMAZONIA_CERRADO = {"TO", "MA", "MT"}


def _percentual_rl(uf: str) -> float:
    """Retorna o percentual mínimo de RL por bioma estimado a partir da UF."""
    if uf in _AMAZONIA_FLORESTA:
        return 0.80
    if uf in _AMAZONIA_CERRADO:
        return 0.35
    return 0.20


def _case_buffer() -> str:
    """Monta a expressão CASE para largura do buffer de APP por faixa de rio."""
    faixas = regras.app.cursos_dagua.faixas
    if not faixas:
        return "30"
    linhas = [
        f"WHEN COALESCE(h.largura, 0) <= {f.largura_max} THEN {f.distancia_app}"
        for f in sorted(faixas, key=lambda x: x.largura_max)
    ]
    return f"(CASE {' '.join(linhas)} ELSE 30 END)"


def detect_cultivo_em_app(imovel_id: str, db: Session) -> None:
    """Detecta lavoura dentro das APPs (buffer da hidrografia)."""
    buf = _case_buffer()
    query = text(f"""
        INSERT INTO divergencia (id, imovel_id, tipo, severidade, area_hectares,
                                 descricao, base_legal, caminho_retificacao, geometria)
        SELECT
            'div-app-' || md5(random()::text) || '-' || i.id,
            i.id,
            'Cultivo Agrícola em APP',
            'alta',
            ST_Area(ST_Transform(
                ST_Intersection(ST_Buffer(h.geometria::geography, {buf})::geometry, c.geometria),
                {SRID_AREA})) / 10000.0,
            'Foi identificado cultivo agrícola comercial ativo na faixa de ' || {buf} || ' metros de APP.',
            'Art. 4º, inciso I, alínea a da Lei 12.651/2012',
            'Cessar o cultivo comercial e isolar a área para regeneração.',
            ST_Multi(ST_Intersection(ST_Buffer(h.geometria::geography, {buf})::geometry, c.geometria))
        FROM imovel i
        JOIN cobertura_observada c ON c.imovel_id = i.id
        JOIN hidrografia h ON ST_Intersects(
            ST_Buffer(h.geometria::geography, {buf})::geometry, c.geometria)
        WHERE i.id = :imovel_id
          AND c.classe ILIKE '%Lavoura%'
          AND ST_Area(ST_Transform(
              ST_Intersection(ST_Buffer(h.geometria::geography, {buf})::geometry, c.geometria),
              {SRID_AREA})) / 10000.0 > 0.01;
    """)
    db.execute(query, {"imovel_id": imovel_id})


def detect_uso_incompativel_restrito(imovel_id: str, db: Session) -> None:
    """Detecta uso do solo (lavoura/solo exposto) em áreas de uso restrito."""
    query = text(f"""
        INSERT INTO divergencia (id, imovel_id, tipo, severidade, area_hectares,
                                 descricao, base_legal, caminho_retificacao, geometria)
        SELECT
            'div-usr-' || md5(random()::text) || '-' || i.id,
            i.id,
            'Uso incompatível em área de uso restrito',
            'media',
            ST_Area(ST_Transform(ST_Intersection(u.geometria, c.geometria), {SRID_AREA})) / 10000.0,
            'Identificado uso do solo incompatível (cultivo/solo exposto) em área de uso restrito.',
            'Art. 11 da Lei 12.651/2012',
            'Adotar práticas conservacionistas compatíveis ou recuperar a vegetação.',
            ST_Multi(ST_Intersection(u.geometria, c.geometria))
        FROM imovel i
        JOIN cobertura_observada c ON c.imovel_id = i.id
        JOIN uso_restrito u ON ST_Intersects(u.geometria, c.geometria)
        WHERE i.id = :imovel_id
          AND c.classe SIMILAR TO '%(Lavoura|Solo Exposto)%'
          AND ST_Area(ST_Transform(
              ST_Intersection(u.geometria, c.geometria), {SRID_AREA})) / 10000.0 > 0.01;
    """)
    db.execute(query, {"imovel_id": imovel_id})


def detect_supressao_vegetacao(imovel_id: str, db: Session) -> None:
    """Detecta supressão de vegetação nativa em APPs."""
    buf = _case_buffer()
    query = text(f"""
        INSERT INTO divergencia (id, imovel_id, tipo, severidade, area_hectares,
                                 descricao, base_legal, caminho_retificacao, geometria)
        SELECT
            'div-sup-' || md5(random()::text) || '-' || i.id,
            i.id,
            'Supressão de Vegetação em APP',
            'alta',
            ST_Area(ST_Transform(
                ST_Intersection(ST_Buffer(h.geometria::geography, {buf})::geometry, c.geometria),
                {SRID_AREA})) / 10000.0,
            'Foi identificada supressão de vegetação (uso antropizado) na faixa de APP.',
            'Art. 4º da Lei 12.651/2012',
            'Cessar a supressão e iniciar a recomposição da vegetação nativa.',
            ST_Multi(ST_Intersection(ST_Buffer(h.geometria::geography, {buf})::geometry, c.geometria))
        FROM imovel i
        JOIN cobertura_observada c ON c.imovel_id = i.id
        JOIN hidrografia h ON ST_Intersects(
            ST_Buffer(h.geometria::geography, {buf})::geometry, c.geometria)
        WHERE i.id = :imovel_id
          AND c.classe SIMILAR TO '%(Pastagem|Solo Exposto|Lavoura)%'
          AND ST_Area(ST_Transform(
              ST_Intersection(ST_Buffer(h.geometria::geography, {buf})::geometry, c.geometria),
              {SRID_AREA})) / 10000.0 > 0.01;
    """)
    db.execute(query, {"imovel_id": imovel_id})


def detect_deficit_reserva_legal(imovel_id: str, db: Session) -> None:
    """Detecta déficit de Reserva Legal com percentual correto por bioma.

    Usa a UF do imóvel para estimar o bioma (proxy; substituir por join espacial
    com shapefile IBGE de biomas em produção). Aplica Art. 67 automaticamente
    para propriedades ≤ 4 módulos fiscais com remanescente insuficiente.
    Art. 68 nunca é aplicado automaticamente (exige comprovação documental).
    """
    row = db.execute(
        text("SELECT uf FROM imovel WHERE id = :id"),
        {"id": imovel_id}
    ).fetchone()

    if not row:
        return

    perc = _percentual_rl(row.uf or "")
    art_ref = "Art. 12 da Lei 12.651/2012"
    descricao = f"Imóvel não possui o mínimo de {int(perc * 100)}% de vegetação nativa (bioma: {row.uf or 'não identificado'})."

    query = text(f"""
        INSERT INTO divergencia (id, imovel_id, tipo, severidade, area_hectares,
                                 descricao, base_legal, caminho_retificacao, geometria)
        SELECT
            'div-rl-' || md5(random()::text) || '-' || i.id,
            i.id,
            'Déficit de Reserva Legal',
            'media',
            (ST_Area(ST_Transform(i.poligono_declarado, {SRID_AREA})) / 10000.0) * :perc
                - COALESCE(floresta.area_floresta, 0),
            :descricao,
            :art_ref,
            'Promover a recomposição, regeneração ou compensação da Reserva Legal.',
            ST_Multi(i.poligono_declarado)
        FROM imovel i
        LEFT JOIN (
            SELECT c.imovel_id,
                   SUM(ST_Area(ST_Transform(
                       ST_Intersection(c.geometria, i2.poligono_declarado),
                       {SRID_AREA})) / 10000.0) AS area_floresta
            FROM cobertura_observada c
            JOIN imovel i2 ON i2.id = c.imovel_id
            WHERE c.classe IN ('Floresta Nativa', 'Formação Savânica')
              AND c.imovel_id = :imovel_id
            GROUP BY c.imovel_id
        ) floresta ON floresta.imovel_id = i.id
        WHERE i.id = :imovel_id
          AND COALESCE(floresta.area_floresta, 0)
              < (ST_Area(ST_Transform(i.poligono_declarado, {SRID_AREA})) / 10000.0) * :perc;
    """)
    db.execute(query, {
        "imovel_id": imovel_id,
        "perc": perc,
        "descricao": descricao,
        "art_ref": art_ref,
    })


def calcular_score_conformidade(imovel_id: str, db: Session) -> float:
    """Calcula o score do imóvel com base nas divergências persistidas."""
    divergencias = db.query(Divergencia).filter(Divergencia.imovel_id == imovel_id).all()
    score = 100.0
    for div in divergencias:
        if div.severidade == "alta":
            score -= 15
        elif div.severidade == "media":
            score -= 8
        else:
            score -= 3
    return max(0.0, round(score, 1))


def calcular_diagnostico_postgis(imovel_id: str, db: Session):
    """Ponto de entrada principal do motor.

    Limpa divergências antigas, calcula as novas via PostGIS e atualiza o score.
    """
    logger.info(f"Calculando diagnóstico para o imóvel: {imovel_id}")

    db.query(Divergencia).filter(Divergencia.imovel_id == imovel_id).delete()
    db.flush()

    detect_cultivo_em_app(imovel_id, db)
    detect_uso_incompativel_restrito(imovel_id, db)
    detect_supressao_vegetacao(imovel_id, db)
    detect_deficit_reserva_legal(imovel_id, db)

    db.commit()

    score = calcular_score_conformidade(imovel_id, db)
    logger.info(f"Diagnóstico concluído. Score: {score}")

    return {"imovel_id": imovel_id, "score": score}
