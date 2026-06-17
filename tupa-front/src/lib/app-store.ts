// Tiny global store for app state without extra deps.
import { useSyncExternalStore } from "react";
import type { NdviHistoryRow } from "@/lib/ndvi";

export type CropStatus = "healthy" | "alert" | "emergency";
export type PayoutStatus = "pending" | "sent" | "received";

export type Language = "es" | "pt" | "en";

export interface Terreno {
  id: string;
  name: string;
  points: { lat: number; lng: number }[];
  sizeVal: string;
  sizeUnit: "ha" | "alqueire_mg" | "alqueire_sp" | "modulo_fiscal";
  hectares: number;
  carNumber: string;
  address: string;
  status: CropStatus;
  selectedCar?: any;
  crops?: string[];
  system?: string;
  ndviHistorico12m?: NdviHistoryRow[];
  ndviRelatorioSemanal?: NdviHistoryRow[];
  ndviRelatorioMensal?: NdviHistoryRow[];
  ndviDataFinal?: string;
  ndviFontePoligono?: "car" | "demarcacao";
}

export interface AppState {
  status: CropStatus;
  protected: boolean;
  payout: PayoutStatus;
  language: Language;
  carVerified: boolean;
  documentoValidado?: boolean | string;
  documentoArquivoNome?: string;
  farmer: {
    name: string;
    property: string;
    location: string;
    area: number;
    crop: string;
    areaPolygon?: { lat: number; lng: number }[];
    cpf?: string;
    phone?: string;
    avatar?: string;
    car?: string;
    firebaseUid?: string;
    terrenos?: Terreno[];
  };
  activeTerrenoId: string;
  password?: string;
  selectedCooperative?: string;
  fieldPhotoUploaded?: boolean;
  inspectionsRequested?: boolean;
}

const defaultInitial: AppState = {
  status: "healthy",
  protected: false,
  payout: "pending",
  language: "es", // Espanhol como padrão
  carVerified: false,
  documentoValidado: false,
  documentoArquivoNome: "",
  fieldPhotoUploaded: false,
  inspectionsRequested: false,
  activeTerrenoId: "",
  farmer: {
    name: "",
    property: "",
    location: "",
    area: 0,
    crop: "",
    areaPolygon: [],
    cpf: "",
    phone: "",
    avatar: "",
    car: "",
    terrenos: [],
  },
};

const getStoredState = (): AppState => {
  if (typeof window === "undefined") return defaultInitial;
  try {
    const stored = localStorage.getItem("safra_segura_state");
    if (!stored) return defaultInitial;
    const parsed = JSON.parse(stored);
    return { ...defaultInitial, ...parsed };
  } catch (e) {
    console.error("Failed to load state from localStorage", e);
    return defaultInitial;
  }
};

let state: AppState = getStoredState();
const listeners = new Set<() => void>();

export const appStore = {
  get: () => state,
  set: (patch: Partial<AppState>) => {
    let newState = { ...state, ...patch };

    // Auto-sync active terrain properties if terrenos or activeTerrenoId changes
    const activeId = newState.activeTerrenoId || "1";
    const terrenos = newState.farmer?.terrenos;
    if (terrenos && terrenos.length > 0) {
      const active = terrenos.find((t) => t.id === activeId) || terrenos[0];
      if (active) {
        const cropLabel =
          active.crops && active.crops.length > 0
            ? active.system
              ? `${active.crops.join(" + ")} (${active.system})`
              : active.crops.join(" + ")
            : "";

        newState = {
          ...newState,
          status: active.status || newState.status,
          farmer: {
            ...newState.farmer,
            crop: cropLabel,
            area: active.hectares || 0,
            location: active.address || "",
            car: active.carNumber || "",
            areaPolygon: active.points || [],
          },
        };
      }
    }

    state = newState;
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("safra_segura_state", JSON.stringify(state));
      } catch (e) {
        console.error("Failed to save state to localStorage", e);
      }
    }
    listeners.forEach((l) => l());
  },
  setActiveTerreno: (id: string) => {
    if (!state.farmer.terrenos) return;
    const found = state.farmer.terrenos.find((t) => t.id === id);
    if (!found) return;
    appStore.set({
      activeTerrenoId: id,
    });
  },
  cycleStatus: () => {
    const order: CropStatus[] = ["healthy", "alert", "emergency"];
    const next = order[(order.indexOf(state.status) + 1) % order.length];

    // Synchronize active terrain's status too
    let updatedTerrenos = state.farmer.terrenos;
    const activeId = state.activeTerrenoId || "1";
    if (updatedTerrenos) {
      updatedTerrenos = updatedTerrenos.map((t) =>
        t.id === activeId ? { ...t, status: next } : t,
      );
    }

    appStore.set({
      status: next,
      payout: "pending",
      // Auto-enable protection on emergency so the trigger screen is reachable in the demo
      protected: next === "emergency" ? true : state.protected,
      farmer: {
        ...state.farmer,
        terrenos: updatedTerrenos,
      },
    });
  },
  subscribe: (cb: () => void) => {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
  loadDemoData: () => {
    appStore.set({
      status: "alert",
      protected: true,
      payout: "pending",
      carVerified: false,
      documentoValidado: false,
      documentoArquivoNome: "",
      fieldPhotoUploaded: false,
      inspectionsRequested: false,
      activeTerrenoId: "1",
      farmer: {
        name: "Geraldo Dias",
        property: "Sítio Boa Esperança",
        location: "Unaí, MG",
        area: 12,
        crop: "Milho (safrinha)",
        areaPolygon: [],
        cpf: "123.456.789-00",
        phone: "(61) 99999-9999",
        avatar: "/avatars/sprout.png",
        car: "",
        terrenos: [
          {
            id: "1",
            name: "Terreno 1",
            points: [],
            sizeVal: "12",
            sizeUnit: "ha",
            hectares: 12,
            carNumber: "",
            address: "Unaí, MG",
            status: "alert",
            selectedCar: null,
            crops: ["Milho"],
            system: "Safrinha",
          },
        ],
      },
    });
  },
  reset: () => {
    state = { ...defaultInitial };
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem("safra_segura_state");
      } catch (e) {
        console.error("Failed to clear state from localStorage", e);
      }
    }
    listeners.forEach((l) => l());
  },
};

export function useAppState() {
  return useSyncExternalStore(appStore.subscribe, appStore.get, appStore.get);
}
