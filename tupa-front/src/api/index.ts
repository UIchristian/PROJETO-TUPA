/**
 * Tupã — Data access layer (mock ↔ API toggle).
 *
 * Set VITE_USE_MOCK=true in .env to use mock data.
 * Set VITE_USE_MOCK=false (or omit) to call the real backend.
 *
 * The screens don't change — they always call getImoveis, getImovel,
 * getDiagnostico, getLayers. Only the data source switches.
 */

import type { Diagnostico, HidrografiaData, Imovel, LayerGeometries } from "@/types/imovel";

// Re-export types for convenience
export type {
  Diagnostico,
  HidrografiaData,
  Imovel,
  LayerGeometries,
  EnquadramentoRL,
} from "@/types/imovel";
export type {
  CoberturaClasse,
  CoberturaPoligono,
  CursoDAguaInfo,
  Divergencia,
  GeoJSONGeometry,
  FeicaoReferencia,
  TipoFeicao,
} from "@/types/imovel";

// Mock implementations (renamed in mock/index.ts)
import {
  getImoveis as mockGetImoveis,
  getImovel as mockGetImovel,
  getDiagnostico as mockGetDiagnostico,
  getLayers as mockGetLayers,
  getCamada as mockGetCamada,
  getLimitesImovel as mockGetLimitesImovel,
  getEnquadramentoRLMock,
} from "@/mock";

// Real API implementations
import {
  getImoveisApi,
  getImovelApi,
  getDiagnosticoApi,
  getLayersApi,
  getHidrografiaApi,
  getCamadaApi,
  getLimitesImovelApi,
  getEnquadramentoRLApi,
} from "@/api/client";

const useMock = import.meta.env.VITE_USE_MOCK === "true";

export const getImoveis = async (): Promise<Imovel[]> => {
  if (useMock) return mockGetImoveis();
  try {
    return await getImoveisApi();
  } catch (err) {
    console.warn("Tupã Auto-Fallback: Backend real falhou (getImoveis), retornando mock...", err);
    return mockGetImoveis();
  }
};

export const getImovel = async (id: string): Promise<Imovel | null> => {
  if (useMock) return mockGetImovel(id);
  try {
    return await getImovelApi(id);
  } catch (err) {
    console.warn(
      `Tupã Auto-Fallback: Backend real falhou (getImovel ${id}), retornando mock...`,
      err,
    );
    return mockGetImovel(id);
  }
};

export const getDiagnostico = async (imovelId: string): Promise<Diagnostico | null> => {
  if (useMock) return mockGetDiagnostico(imovelId);
  try {
    return await getDiagnosticoApi(imovelId);
  } catch (err) {
    console.warn(
      `Tupã Auto-Fallback: Backend real falhou (getDiagnostico ${imovelId}), retornando mock...`,
      err,
    );
    return mockGetDiagnostico(imovelId);
  }
};

export const getLayers = async (imovelId: string): Promise<LayerGeometries | null> => {
  if (useMock) return mockGetLayers(imovelId);
  try {
    return await getLayersApi(imovelId);
  } catch (err) {
    console.warn(
      `Tupã Auto-Fallback: Backend real falhou (getLayers ${imovelId}), retornando mock...`,
      err,
    );
    return mockGetLayers(imovelId);
  }
};

export const getHidrografia = async (imovelId: string): Promise<HidrografiaData | null> => {
  try {
    return await getHidrografiaApi(imovelId);
  } catch (err) {
    console.warn(
      `Tupã Auto-Fallback: Backend real falhou (getHidrografia ${imovelId}), retornando null...`,
      err,
    );
    return null;
  }
};

export const getCamada = async (
  municipio: string,
  tipo: TipoFeicao,
): Promise<FeicaoReferencia[]> => {
  if (useMock) return mockGetCamada(municipio, tipo);
  try {
    return await getCamadaApi(municipio, tipo);
  } catch (err) {
    console.warn(
      `Tupã Auto-Fallback: Backend real falhou (getCamada ${municipio} - ${tipo}), retornando mock...`,
      err,
    );
    return mockGetCamada(municipio, tipo);
  }
};

export const getLimitesImovel = async (
  municipio: string,
): Promise<{ id: string; nome: string; numeroCar: string; geometry: GeoJSONGeometry }[]> => {
  if (useMock) return mockGetLimitesImovel(municipio);
  try {
    return await getLimitesImovelApi(municipio);
  } catch (err) {
    console.warn(
      `Tupã Auto-Fallback: Backend real falhou (getLimitesImovel ${municipio}), retornando mock...`,
      err,
    );
    return mockGetLimitesImovel(municipio);
  }
};

export const getBaseReferencia = async (
  municipio: string,
): Promise<{
  limites: { id: string; nome: string; numeroCar: string; geometry: GeoJSONGeometry }[];
  feicoes: FeicaoReferencia[];
}> => {
  const tipos: TipoFeicao[] = [
    "APP_CURSO_DAGUA",
    "APP_NASCENTE",
    "APP_LAGO",
    "APP_VEREDA",
    "USO_RESTRITO_ENCOSTA",
    "RESERVA_LEGAL_PROPOSTA",
    "COBERTURA",
  ];

  const limitesPromise = getLimitesImovel(municipio);
  const camadasPromises = tipos.map((t) => getCamada(municipio, t));

  const [limites, ...camadasRes] = await Promise.all([limitesPromise, ...camadasPromises]);

  const feicoes = camadasRes.flat();
  return { limites, feicoes };
};

export const getEnquadramentoRL = async (imovelId: string) => {
  if (useMock) return getEnquadramentoRLMock(imovelId);
  try {
    return await getEnquadramentoRLApi(imovelId);
  } catch (err) {
    console.warn(
      `Tupã Auto-Fallback: Backend real falhou (getEnquadramentoRL ${imovelId}), retornando mock...`,
      err,
    );
    return getEnquadramentoRLMock(imovelId);
  }
};
