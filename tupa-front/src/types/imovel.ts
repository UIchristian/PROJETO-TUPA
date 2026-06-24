/**
 * Tupã — Shared types for property diagnostics.
 *
 * These types mirror the Pydantic schemas in tupa-back/schemas.py.
 * The API client maps snake_case responses to these camelCase interfaces.
 */

export interface GeoJSONGeometry {
  type: string;
  coordinates: number[][][] | number[][] | number[];
}

export interface Imovel {
  id: string;
  nome: string;
  municipio: string;
  uf: string;
  areaHectares: number;
  numeroCAR: string;
  poligonoDeclarado: GeoJSONGeometry;
}

export interface CoberturaClasse {
  classe: string;
  percentual: number;
  corHex: string;
}

export interface Divergencia {
  id: string;
  tipo: string;
  areaHectares: number;
  severidade: "alta" | "media" | "baixa";
  textoLinguagemSimples: string;
  baseLegal: string;
  caminhoRetificacao: string;
  poligonoDivergencia: GeoJSONGeometry;
}

export interface Diagnostico {
  imovelId: string;
  scoreConformidade: number;
  coberturaSolo: CoberturaClasse[];
  divergencias: Divergencia[];
}

export interface CoberturaPoligono {
  classe: string;
  corHex: string;
  geometry: GeoJSONGeometry;
}

export interface CursoDAguaInfo {
  id: number;
  tipo: string;
  larguraM: number | null;
  comprimentoInternoM: number;
  comprimentoTotalM: number;
  faixaAppM: number;
}

export interface HidrografiaData {
  imovelId: string;
  totalCursos: number;
  cursos: CursoDAguaInfo[];
}

export interface LayerGeometries {
  poligonoDeclarado: GeoJSONGeometry;
  app?: GeoJSONGeometry;
  usoRestrito?: GeoJSONGeometry;
  gabarito?: GeoJSONGeometry;
  divergencias: Divergencia[];
  coberturaPoligonos: CoberturaPoligono[];
}
