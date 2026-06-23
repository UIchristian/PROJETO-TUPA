/**
 * Tupã — HTTP client for the FastAPI backend.
 *
 * Maps snake_case API responses to camelCase TypeScript types.
 */
import type {
  CoberturaClasse,
  CoberturaPoligono,
  CursoDAguaInfo,
  Diagnostico,
  Divergencia,
  GeoJSONGeometry,
  HidrografiaData,
  Imovel,
  LayerGeometries,
} from "@/types/imovel";

const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) {
    const detail = await res.text().catch(() => res.statusText);
    throw new Error(`API ${res.status}: ${detail}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Snake-case → camelCase mappers
// ---------------------------------------------------------------------------

function mapGeometry(g: any): GeoJSONGeometry {
  return { type: g?.type ?? "Polygon", coordinates: g?.coordinates ?? [] };
}

function mapDivergencia(d: any): Divergencia {
  return {
    id: d.id,
    tipo: d.tipo,
    areaHectares: d.area_hectares,
    severidade: d.severidade,
    textoLinguagemSimples: d.texto_linguagem_simples,
    baseLegal: d.base_legal ?? "",
    caminhoRetificacao: d.caminho_retificacao,
    poligonoDivergencia: mapGeometry(d.poligono_divergencia),
  };
}

function mapImovel(raw: any): Imovel {
  return {
    id: raw.id,
    nome: raw.nome,
    municipio: raw.municipio,
    uf: raw.uf,
    areaHectares: raw.area_hectares,
    numeroCAR: raw.numero_car,
    poligonoDeclarado: mapGeometry(raw.poligono_declarado),
  };
}

function mapCoberturaClasse(c: any): CoberturaClasse {
  return {
    classe: c.classe,
    percentual: c.percentual,
    corHex: c.cor_hex,
  };
}

function mapCoberturaPoligono(c: any): CoberturaPoligono {
  return {
    classe: c.classe,
    corHex: c.cor_hex,
    geometry: mapGeometry(c.geometry),
  };
}

// ---------------------------------------------------------------------------
// Public API functions
// ---------------------------------------------------------------------------

function mapCursoDAguaInfo(c: any): CursoDAguaInfo {
  return {
    id: c.id,
    tipo: c.tipo,
    larguraM: c.largura_m ?? null,
    comprimentoInternoM: c.comprimento_interno_m,
    comprimentoTotalM: c.comprimento_total_m,
    faixaAppM: c.faixa_app_m,
  };
}

export async function getHidrografiaApi(
  imovelId: string,
): Promise<HidrografiaData | null> {
  try {
    const raw = await fetchJson<any>(
      `/imovel/${encodeURIComponent(imovelId)}/hidrografia`,
    );
    return {
      imovelId: raw.imovel_id,
      totalCursos: raw.total_cursos,
      cursos: (raw.cursos ?? []).map(mapCursoDAguaInfo),
    };
  } catch (err: any) {
    if (err.message?.includes("404")) return null;
    throw err;
  }
}

export async function getImoveisApi(): Promise<Imovel[]> {
  const raw = await fetchJson<any[]>("/imoveis");
  return raw.map(mapImovel);
}

export async function getImovelApi(id: string): Promise<Imovel | null> {
  try {
    const raw = await fetchJson<any>(`/imovel/${encodeURIComponent(id)}`);
    return mapImovel(raw);
  } catch (err: any) {
    if (err.message?.includes("404")) return null;
    throw err;
  }
}

export async function getDiagnosticoApi(
  imovelId: string,
): Promise<Diagnostico | null> {
  try {
    const raw = await fetchJson<any>(
      `/imovel/${encodeURIComponent(imovelId)}/diagnostico`,
    );
    return {
      imovelId: raw.imovel_id,
      scoreConformidade: raw.score_conformidade,
      coberturaSolo: (raw.cobertura_solo ?? []).map(mapCoberturaClasse),
      divergencias: (raw.divergencias ?? []).map(mapDivergencia),
    };
  } catch (err: any) {
    if (err.message?.includes("404")) return null;
    throw err;
  }
}

export async function getLayersApi(
  imovelId: string,
): Promise<LayerGeometries | null> {
  try {
    const raw = await fetchJson<any>(
      `/imovel/${encodeURIComponent(imovelId)}/diagnostico`,
    );
    const camadas = raw.camadas;
    if (!camadas) return null;

    return {
      poligonoDeclarado: mapGeometry(camadas.poligono_declarado),
      app: mapGeometry(camadas.app),
      usoRestrito: camadas.uso_restrito
        ? mapGeometry(camadas.uso_restrito)
        : undefined,
      gabarito: camadas.gabarito
        ? mapGeometry(camadas.gabarito)
        : undefined,
      divergencias: (camadas.divergencias ?? []).map(mapDivergencia),
      coberturaPoligonos: (camadas.cobertura_poligonos ?? []).map(
        mapCoberturaPoligono,
      ),
    };
  } catch (err: any) {
    if (err.message?.includes("404")) return null;
    throw err;
  }
}
