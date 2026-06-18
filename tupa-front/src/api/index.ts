/**
 * Tupã — Data access layer (mock ↔ API toggle).
 *
 * Set VITE_USE_MOCK=true in .env to use mock data.
 * Set VITE_USE_MOCK=false (or omit) to call the real backend.
 *
 * The screens don't change — they always call getImoveis, getImovel,
 * getDiagnostico, getLayers. Only the data source switches.
 */

import type {
  Diagnostico,
  Imovel,
  LayerGeometries,
} from "@/types/imovel";

// Re-export types for convenience
export type { Diagnostico, Imovel, LayerGeometries } from "@/types/imovel";
export type {
  CoberturaClasse,
  CoberturaPoligono,
  Divergencia,
  GeoJSONGeometry,
} from "@/types/imovel";

// Mock implementations (renamed in mock/index.ts)
import {
  getImoveis as mockGetImoveis,
  getImovel as mockGetImovel,
  getDiagnostico as mockGetDiagnostico,
  getLayers as mockGetLayers,
} from "@/mock";

// Real API implementations
import {
  getImoveisApi,
  getImovelApi,
  getDiagnosticoApi,
  getLayersApi,
} from "@/api/client";

const useMock = import.meta.env.VITE_USE_MOCK === "true";

export const getImoveis: () => Promise<Imovel[]> = useMock
  ? mockGetImoveis
  : getImoveisApi;

export const getImovel: (id: string) => Promise<Imovel | null> = useMock
  ? mockGetImovel
  : getImovelApi;

export const getDiagnostico: (
  imovelId: string,
) => Promise<Diagnostico | null> = useMock
  ? mockGetDiagnostico
  : getDiagnosticoApi;

export const getLayers: (
  imovelId: string,
) => Promise<LayerGeometries | null> = useMock
  ? mockGetLayers
  : getLayersApi;
