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
  situacao?: "Pendente de análise" | "Analisado" | "Cancelado" | "Suspenso" | "Ativo";
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

export interface MunicipioStats {
  municipio: string;
  totalImoveis: number;
  mediaScore: number;
  percConformidade: number;
  totalAppHa: number;
  totalRlHa: number;
  totalUsoRestritoHa: number;
}

export interface ImovelResumo {
  imovelId: string;
  nome: string;
  numeroCar: string;
  scoreConformidade: number;
  divergencias: Divergencia[];
  coberturaSolo: CoberturaClasse[];
}

// Conceito "base de referência": base gerada + confiança por feição.

/** Nível de confiança. ATENÇÃO: alta = bom (verde), o oposto de severidade. */
export type NivelConfianca = "alta" | "media" | "baixa";

/** Tipos de feição (espelha feicao_referencia no back). */
export type TipoFeicao =
  | "APP_CURSO_DAGUA"
  | "APP_NASCENTE"
  | "APP_LAGO"
  | "APP_VEREDA"
  | "APP_GERAL"
  | "USO_RESTRITO_ENCOSTA"
  | "RESERVA_LEGAL_PROPOSTA"
  | "COBERTURA"
  | "AREA_ANTROPIZADA"
  | "REMANESCENTE_NATIVO"
  | "AREA_CONSOLIDADA_APP"
  | "CORPO_DAGUA"
  | (string & {});

export type DecisaoFeicao = "pendente" | "validada" | "ajustada" | "rejeitada";

export interface FeicaoReferencia {
  id: string;
  imovelId?: string;
  municipio: string;
  tipo: TipoFeicao;
  subclasse?: string;
  baseLegal: string; // ex: "Art. 4, I, Lei 12.651/2012"
  areaHectares: number;
  confianca: NivelConfianca;
  confiancaMotivo?: string; // ex: "largura do rio desconhecida"
  geometry: GeoJSONGeometry;
  decisao?: DecisaoFeicao;
  observacao?: string;
}

export interface FeicaoReferenciaCollection {
  municipio: string;
  feicoes: FeicaoReferencia[];
}

/** Status de cobertura de um município (Tela 1). */
export interface CoberturaMunicipal {
  municipio: string;
  uf: string;
  temBaseReferencia: boolean;
  totalImoveis: number;
  imoveisImpactados: number;
  haSemCobertura: number;
}

/** Enquadramento da Reserva Legal (Tela 5). */
export interface EnquadramentoRL {
  imovelId: string;
  enquadramento: string; // "Art. 12, Lei 12.651/2012" | "Art. 67, ..."
  areaLiquidaHa: number;
  modulosFiscais: number;
  rlExigidaHa: number;
  deficitHa: number;
  confianca: NivelConfianca;
  observacao?: string | null;
  bioma?: string;
  percentualAplicavel?: number;
  art68Pendente?: boolean; // Art. 68 nunca é aplicado sozinho (manual)
}

/** Resumo da base gerada (Tela 6). */
export interface ResumoBase {
  municipio: string;
  totalFeicoes: number;
  haApp: number;
  haReservaLegal: number;
  haUsoRestrito: number;
  percAlta: number;
  percMedia: number;
  percBaixa: number;
}
