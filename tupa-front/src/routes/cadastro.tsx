import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { lazy, Suspense, useState, useEffect } from "react";
import type { LatLngLiteral } from "leaflet";
import { MapPin, ChevronLeft, ChevronDown, Info, Search, Loader2 } from "lucide-react";
import { MobileFrame } from "@/components/MobileFrame";
import { useAppState, appStore, CropStatus } from "@/lib/app-store";
import { parseNdviDataset, type NdviHistoryRow } from "@/lib/ndvi";
import { t, useTranslation } from "@/lib/i18n";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../../firebase";

const FarmMap = lazy(() => import("@/components/FarmMap"));

type CarItem = {
  codigo_imovel?: string;
  codigo?: string;
  numero?: string;
  cod_imovel?: string;
  municipio?: string;
  cidade?: string;
  uf?: string;
  estado?: string;
  area_ha?: number;
  area_imovel_ha?: number;
  area?: number;
  [key: string]: any;
};

type PolygonPoint = { lat: number; lng: number };

import { BUSCAR_CARS_ENDPOINT, NDVI_ENDPOINT } from "@/lib/api-config";

function normalizePolygonPoint(point: any): PolygonPoint | null {
  if (!point) return null;

  if (Array.isArray(point) && point.length >= 2) {
    const lng = Number(point[0]);
    const lat = Number(point[1]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return { lat, lng };
    }
  }

  const lat = Number(point.lat ?? point.latitude);
  const lng = Number(point.lng ?? point.lon ?? point.longitude);
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return { lat, lng };
  }

  return null;
}

function normalizePolygon(value: any): PolygonPoint[] {
  if (!Array.isArray(value)) return [];

  const direct = value
    .map((item) => normalizePolygonPoint(item))
    .filter((item): item is PolygonPoint => !!item);

  if (direct.length >= 3) return direct;

  for (const item of value) {
    const nested = normalizePolygon(item);
    if (nested.length >= 3) return nested;
  }

  return [];
}

function extractCarPolygon(car: CarItem | null | undefined): PolygonPoint[] {
  if (!car) return [];

  const candidates = [
    car.poligono,
    car.polygon,
    car.poligono_car,
    car.poligonoCAR,
    car.areaPolygon,
    car.area_polygon,
    car.geometry?.coordinates,
    car.geometria?.coordinates,
    car.geometria,
  ];

  for (const candidate of candidates) {
    const normalized = normalizePolygon(candidate);
    if (normalized.length >= 3) {
      return normalized;
    }
  }

  return [];
}

async function fetchNdviHistory(polygon: PolygonPoint[], dataFinal: string) {
  const response = await fetch(NDVI_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      poligono: polygon,
      data_final: dataFinal,
    }),
  });

  if (!response.ok) {
    throw new Error(`Falha NDVI: HTTP ${response.status}`);
  }

  const payload = await response.json();
  const parsed = parseNdviDataset(payload);
  if (parsed.monthly.length === 0 && parsed.weekly.length === 0 && parsed.all.length === 0) {
    throw new Error("Resposta NDVI sem dados validos.");
  }

  return parsed;
}

function getCarCode(car: CarItem, fallback: string) {
  return String(car.codigo_imovel ?? car.codigo ?? car.numero ?? car.cod_imovel ?? fallback);
}

function getCarLocation(car: CarItem) {
  const municipio = car.municipio ?? car.cidade ?? car.municipio_nome ?? "";
  const uf = car.uf ?? car.estado ?? "";
  return [municipio, uf].filter(Boolean).join(" - ");
}

function getCarArea(car: CarItem): number | null {
  const value = car.area_ha ?? car.area_imovel_ha ?? car.area;
  if (value === undefined || value === null || Number.isNaN(Number(value))) {
    return null;
  }
  return Number(value);
}

export const Route = createFileRoute("/cadastro")({
  head: () => {
    const lang = appStore.get().language || "es";
    return {
      meta: [{ title: t("cadastro.title", lang) }],
    };
  },
  component: CadastroScreen,
});

function ProgressDots({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {[1, 2, 3].map((i) => (
        <span
          key={i}
          className={`h-1.5 rounded-full transition-all ${
            i === step ? "w-6 bg-primary" : "w-1.5 bg-border"
          }`}
        />
      ))}
    </div>
  );
}

function CadastroScreen() {
  const navigate = useNavigate();
  const state = useAppState();
  const { t, language } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [savingProgress, setSavingProgress] = useState(0);
  const [savingStepText, setSavingStepText] = useState("");
  const [ndviErrorData, setNdviErrorData] = useState<{
    polygon: PolygonPoint[];
    dataFinal: string;
    terrenos: any[];
  } | null>(null);
  const [activeMethod, setActiveMethod] = useState<"draw" | "upload">("draw");
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStepText, setUploadStepText] = useState("");
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);

  // Terrains list state
  const [terrenos, setTerrenos] = useState<
    Array<{
      id: string;
      name: string;
      points: LatLngLiteral[];
      sizeVal: string;
      sizeUnit: "ha" | "alqueire_mg" | "alqueire_sp" | "modulo_fiscal";
      carNumber: string;
      address: string;
      selectedCar: CarItem | null;
      status: CropStatus;
      crops?: string[];
      system?: string;
      ndviHistorico12m?: NdviHistoryRow[];
      ndviRelatorioSemanal?: NdviHistoryRow[];
      ndviRelatorioMensal?: NdviHistoryRow[];
      ndviDataFinal?: string;
      ndviFontePoligono?: "car" | "demarcacao";
    }>
  >([
    {
      id: "1",
      name: "Terreno 1",
      points: [],
      sizeVal: "12",
      sizeUnit: "ha" as const,
      carNumber: "",
      address: "",
      selectedCar: null,
      status: "alert",
    },
  ]);
  const [activeId, setActiveId] = useState<string>("1");

  // Form states bound to active terrain
  const [points, setPoints] = useState<LatLngLiteral[]>([]);
  const [address, setAddress] = useState("");
  const [sizeVal, setSizeVal] = useState("12");
  const [sizeUnit, setSizeUnit] = useState<"ha" | "alqueire_mg" | "alqueire_sp" | "modulo_fiscal">(
    "ha",
  );
  const [carNumber, setCarNumber] = useState("");
  const [selectedCar, setSelectedCar] = useState<CarItem | null>(null);

  // Address Nominatim search states
  const [searchingAddress, setSearchingAddress] = useState(false);
  const [searchAddressError, setSearchAddressError] = useState("");
  const [mapCenter, setMapCenter] = useState<LatLngLiteral | null>(null);

  const handleSearchAddress = async () => {
    if (!address.trim()) return;
    setSearchingAddress(true);
    setSearchAddressError("");
    try {
      const resp = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address)}`,
      );
      if (!resp.ok) throw new Error("Erro de rede");
      const list = await resp.json();
      if (list && list.length > 0) {
        const item = list[0];
        const newCenter = {
          lat: parseFloat(item.lat),
          lng: parseFloat(item.lon),
        };
        setMapCenter(newCenter);
        if (item.display_name) {
          setAddress(item.display_name);
        }
      } else {
        setSearchAddressError(
          language === "es"
            ? "Dirección no encontrada."
            : language === "en"
              ? "Address not found."
              : "Endereço não encontrado.",
        );
      }
    } catch (e) {
      console.error(e);
      setSearchAddressError(
        language === "es"
          ? "No se pudo buscar la dirección."
          : language === "en"
            ? "Could not search the address."
            : "Não foi possível buscar o endereço.",
      );
    } finally {
      setSearchingAddress(false);
    }
  };

  const handleFileUploadSimulated = (fileName: string) => {
    setIsUploadingFile(true);
    setUploadProgress(0);
    setUploadStepText(
      language === "es"
        ? "Leyendo archivo..."
        : language === "en"
          ? "Reading file..."
          : "Lendo arquivo...",
    );

    const steps = [
      {
        progress: 25,
        text:
          language === "es"
            ? "Analizando geometría..."
            : language === "en"
              ? "Analyzing geometry..."
              : "Analisando geometria...",
      },
      {
        progress: 65,
        text:
          language === "es"
            ? "Buscando inmueble en el CAR..."
            : language === "en"
              ? "Finding property in CAR..."
              : "Buscando imóvel no CAR...",
      },
      {
        progress: 100,
        text:
          language === "es"
            ? "¡Archivo importado con éxito!"
            : language === "en"
              ? "File imported successfully!"
              : "Arquivo importado com sucesso!",
      },
    ];

    let currentStep = 0;
    const interval = setInterval(() => {
      if (currentStep < steps.length) {
        setUploadProgress(steps[currentStep].progress);
        setUploadStepText(steps[currentStep].text);
        currentStep++;
      } else {
        clearInterval(interval);
        setIsUploadingFile(false);
        setUploadedFileName(fileName);

        const mockImovel = {
          codigo_imovel: "BR-MG-3170107-123456-78",
          municipio: "Unaí",
          uf: "MG",
          area_ha: 345,
          poligono: [
            [-46.895, -16.35],
            [-46.875, -16.35],
            [-46.875, -16.36],
            [-46.895, -16.36],
            [-46.895, -16.35],
          ],
        };

        setSelectedCar(mockImovel);
        setCarNumber(mockImovel.codigo_imovel);
        setCarFound(true);
        setAddress(`${mockImovel.municipio} - ${mockImovel.uf}`);
        setSizeVal(String(mockImovel.area_ha));
        setSizeUnit("ha");

        const coords: LatLngLiteral[] = [
          { lat: -16.35, lng: -46.895 },
          { lat: -16.35, lng: -46.875 },
          { lat: -16.36, lng: -46.875 },
          { lat: -16.36, lng: -46.895 },
        ];
        setPoints(coords);
      }
    }, 450);
  };

  // CAR fetch states
  const [carSearching, setCarSearching] = useState(false);
  const [carFound, setCarFound] = useState(false);
  const [carsFound, setCarsFound] = useState<CarItem[]>([]);
  const [carError, setCarError] = useState("");
  const [carOpen, setCarOpen] = useState(false);

  // Load from active terrain when activeId changes
  useEffect(() => {
    const active = terrenos.find((t) => t.id === activeId);
    if (active) {
      setPoints(active.points);
      setAddress(active.address);
      setSizeVal(active.sizeVal);
      setSizeUnit(active.sizeUnit);
      setCarNumber(active.carNumber);
      setSelectedCar(active.selectedCar);
      setCarsFound([]);
      setCarError("");
      setCarFound(!!active.carNumber);
      setCarOpen(!!active.carNumber);
    }
  }, [activeId]);

  // Save changes from local inputs to active terrain
  useEffect(() => {
    setTerrenos((prev) =>
      prev.map((t) =>
        t.id === activeId
          ? {
              ...t,
              points,
              address,
              sizeVal,
              sizeUnit,
              carNumber,
              selectedCar,
            }
          : t,
      ),
    );
  }, [points, address, sizeVal, sizeUnit, carNumber, selectedCar, activeId]);

  const numericSize = parseFloat(sizeVal) || 0;
  let areaInHectares = numericSize;
  if (sizeUnit === "alqueire_mg") areaInHectares = numericSize * 4.84;
  else if (sizeUnit === "alqueire_sp") areaInHectares = numericSize * 2.42;
  else if (sizeUnit === "modulo_fiscal") areaInHectares = numericSize * 60;

  const formattedHectares = Number(areaInHectares.toFixed(2));

  let farmerClass: "pequeno" | "medio" | "grande" = "pequeno";
  if (formattedHectares > 900) {
    farmerClass = "grande";
  } else if (formattedHectares > 240) {
    farmerClass = "medio";
  }

  const handleAddTerreno = () => {
    const nextId = String(Date.now());
    const newName =
      language === "es"
        ? `Terreno ${terrenos.length + 1}`
        : language === "en"
          ? `Terrain ${terrenos.length + 1}`
          : `Terreno ${terrenos.length + 1}`;
    const newTerreno = {
      id: nextId,
      name: newName,
      points: [],
      sizeVal: "0",
      sizeUnit: "ha" as const,
      carNumber: "",
      address: "",
      selectedCar: null,
      status: "healthy" as CropStatus,
      crops: ["Milho"],
      system: "Safrinha",
    };
    setTerrenos([...terrenos, newTerreno]);
    setActiveId(nextId);
  };

  const handleRemoveTerreno = (idToRemove: string) => {
    if (terrenos.length <= 1) return;
    const filtered = terrenos.filter((t) => t.id !== idToRemove);
    setTerrenos(filtered);
    if (activeId === idToRemove) {
      setActiveId(filtered[0].id);
    }
  };

  const handleFetchCarByArea = async () => {
    if (points.length < 3) {
      setCarError(
        language === "es"
          ? "Por favor, demarca al menos 3 puntos en el mapa antes de buscar el CAR."
          : language === "en"
            ? "Please outline at least 3 points on the map before searching for the CAR."
            : "Demarque pelo menos 3 pontos no mapa antes de buscar o CAR.",
      );
      setCarOpen(true);
      return;
    }
    setCarError("");
    setCarSearching(true);
    setCarOpen(true);
    setCarFound(false);
    setSelectedCar(null);
    setCarsFound([]);

    try {
      const response = await fetch(BUSCAR_CARS_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          poligono: points.map((p) => ({ lat: p.lat, lng: p.lng })),
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const list: CarItem[] = Array.isArray(data)
        ? data
        : Array.isArray(data?.cars)
          ? data.cars
          : Array.isArray(data?.resultados)
            ? data.resultados
            : Array.isArray(data?.items)
              ? data.items
              : Array.isArray(data?.data)
                ? data.data
                : [];

      setCarsFound(list);

      if (list.length === 0) {
        setCarError(
          language === "es"
            ? "Ningún CAR encontrado en el área demarcada."
            : language === "en"
              ? "No CAR found in the outlined area."
              : "Nenhum CAR encontrado na área demarcada.",
        );
      }
    } catch (err) {
      console.error("Falha ao buscar CAR no backend:", err);
      setCarError(
        language === "es"
          ? "No se pudo realizar la verificación de datos. Verifica que el servidor esté activo."
          : language === "en"
            ? "Could not complete data verification. Make sure the server is running."
            : "Não foi possível fazer a verificação de dados. Verifique se o servidor está ativo.",
      );
    } finally {
      setCarSearching(false);
    }
  };

  const handleSelectCar = (car: CarItem, idx: number) => {
    const code = getCarCode(car, `CAR-${idx + 1}`);
    setSelectedCar(car);
    setCarNumber(code);
    setCarFound(true);
  };

  const handleResetSelectedCar = () => {
    setSelectedCar(null);
    setCarsFound([]);
    setCarNumber("");
    setCarFound(false);
  };

  // Map drawer state
  const [mapOpen, setMapOpen] = useState(false);

  const regionFicticia = "Região Fictícia - Noroeste MG";

  const handleConfirmCadastro = () => {
    confirmCadastro(false);
  };

  const confirmCadastro = async (shouldSkipNdvi: boolean) => {
    setSaveError("");
    setNdviErrorData(null);
    setSaving(true);
    setSavingProgress(10);
    setSavingStepText(
      language === "es"
        ? "Conectando al satélite..."
        : language === "en"
          ? "Connecting to satellite..."
          : "Conectando ao satélite...",
    );

    // Make sure we calculate the hectares for each terrain correctly
    const finalTerrenos = terrenos.map((t) => {
      const tSize = parseFloat(t.sizeVal) || 0;
      let tHectares = tSize;
      if (t.sizeUnit === "alqueire_mg") tHectares = tSize * 4.84;
      else if (t.sizeUnit === "alqueire_sp") tHectares = tSize * 2.42;
      else if (t.sizeUnit === "modulo_fiscal") tHectares = tSize * 60;
      return {
        ...t,
        hectares: Number(tHectares.toFixed(2)),
      };
    });

    const totalHectares = Number(
      finalTerrenos.reduce((sum, t) => sum + (t.hectares || 0), 0).toFixed(2),
    );

    try {
      const dataFinalNdvi = new Date().toISOString().slice(0, 10);

      // Simulate step progress increments
      const progressInterval = setInterval(() => {
        setSavingProgress((prev) => {
          if (prev < 90) {
            const next = prev + Math.floor(Math.random() * 8) + 2;
            if (next >= 30 && next < 55) {
              setSavingStepText(
                language === "es"
                  ? "Buscando imágenes de satélite..."
                  : language === "en"
                    ? "Fetching satellite imagery..."
                    : "Buscando imagens de satélite...",
              );
            } else if (next >= 55 && next < 80) {
              setSavingStepText(
                language === "es"
                  ? "Calculando vegetación de los últimos 12 meses..."
                  : language === "en"
                    ? "Calculating vegetation for the last 12 months..."
                    : "Calculando vegetação dos últimos 12 meses...",
              );
            } else if (next >= 80) {
              setSavingStepText(
                language === "es"
                  ? "Casi listo, finalizando cuenta..."
                  : language === "en"
                    ? "Almost there, finalizing account..."
                    : "Quase lá, finalizando conta...",
              );
            }
            return next;
          }
          return prev;
        });
      }, 700);

      const terrenosComNdvi = await Promise.all(
        finalTerrenos.map(async (terreno) => {
          const carPolygon = extractCarPolygon(terreno.selectedCar);
          const polygonForNdvi = carPolygon.length >= 3 ? carPolygon : terreno.points;

          if (polygonForNdvi.length < 3 || shouldSkipNdvi) {
            return {
              ...terreno,
              ndviHistorico12m: [],
              ndviRelatorioSemanal: [],
              ndviRelatorioMensal: [],
              ndviDataFinal: dataFinalNdvi,
              ndviFontePoligono: (carPolygon.length >= 3 ? "car" : "demarcacao") as
                | "car"
                | "demarcacao",
            };
          }

          try {
            const ndviDataset = await fetchNdviHistory(polygonForNdvi, dataFinalNdvi);
            const ndviHistorico12m =
              ndviDataset.monthly.length > 0 ? ndviDataset.monthly : ndviDataset.all.slice(-12);

            return {
              ...terreno,
              ndviHistorico12m,
              ndviRelatorioSemanal: ndviDataset.weekly,
              ndviRelatorioMensal: ndviDataset.monthly,
              ndviDataFinal: dataFinalNdvi,
              ndviFontePoligono: (carPolygon.length >= 3 ? "car" : "demarcacao") as
                | "car"
                | "demarcacao",
            };
          } catch (ndviErr) {
            console.error("NDVI fetch failed inside terrain:", ndviErr);
            throw {
              type: "NDVI_FETCH_ERROR",
              terrenos: finalTerrenos,
              polygon: polygonForNdvi,
              dataFinal: dataFinalNdvi,
            };
          }
        }),
      ).catch((err) => {
        clearInterval(progressInterval);
        throw err;
      });

      clearInterval(progressInterval);
      setSavingProgress(100);

      const firstTerreno = terrenosComNdvi[0];

      const nextFarmer = {
        ...state.farmer,
        crop: "Uso declaratório do solo",
        location: firstTerreno?.address || address.trim(),
        area: totalHectares || formattedHectares || state.farmer.area,
        areaPolygon: firstTerreno?.points || points,
        car: firstTerreno?.carNumber || carNumber || undefined,
        terrenos: terrenosComNdvi,
      };

      appStore.set({
        farmer: nextFarmer,
        activeTerrenoId: firstTerreno?.id || "1",
        status: firstTerreno?.status || "alert",
      });

      const uid = state.farmer.firebaseUid || auth.currentUser?.uid;

      if (!uid) {
        throw new Error(
          "Não foi possível identificar o usuário autenticado para concluir o cadastro.",
        );
      }

      await setDoc(
        doc(db, "usuarios", uid),
        {
          nome: nextFarmer.name,
          cpf: nextFarmer.cpf || "",
          telefone: nextFarmer.phone || "",
          regiaoMapa: regionFicticia,
          enderecoInformado: nextFarmer.location,
          areaPolygon: nextFarmer.areaPolygon,
          produtosCultivados: [],
          sistema: "",
          hectares: totalHectares,
          numeroCAR: nextFarmer.car || "",
          carSelecionado: firstTerreno?.selectedCar ?? null,
          ndviHistorico12m: firstTerreno?.ndviHistorico12m ?? [],
          ndviRelatorioSemanal: firstTerreno?.ndviRelatorioSemanal ?? [],
          ndviRelatorioMensal: firstTerreno?.ndviRelatorioMensal ?? [],
          ndviDataFinal: firstTerreno?.ndviDataFinal ?? dataFinalNdvi,
          terrenos: terrenosComNdvi,
          atualizadoEm: serverTimestamp(),
        },
        { merge: true },
      );

      navigate({ to: "/onboarding" });
    } catch (error: any) {
      console.error(error);
      if (error && error.type === "NDVI_FETCH_ERROR") {
        setNdviErrorData({
          polygon: error.polygon,
          dataFinal: error.dataFinal,
          terrenos: error.terrenos,
        });
      } else {
        setSaveError(
          language === "es"
            ? "No se pudo guardar tu registro. Intenta nuevamente."
            : language === "en"
              ? "Could not save your registration. Please try again."
              : "Não foi possível salvar seu cadastro. Tente novamente.",
        );
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <MobileFrame>
      <header className="px-5 pt-5 pb-3 flex items-center justify-between">
        <Link to="/" className="-ml-2 p-2 text-navy">
          <ChevronLeft size={22} />
        </Link>
        <ProgressDots step={2} />
        <span className="text-sm text-muted-foreground">2/3</span>
      </header>

      <div className="px-5 pb-6 flex-1 flex flex-col gap-5">
        <div>
          <h2 className="text-xl font-bold text-foreground">{t("cadastro.where")}</h2>
          <p className="text-base text-foreground/80 mt-1">{t("cadastro.demarcate")}</p>
        </div>

        {/* Terrains tab selector */}
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center">
            <span className="text-base font-bold text-foreground/90">
              {language === "es"
                ? "Tus Terrenos"
                : language === "en"
                  ? "Your Terrains"
                  : "Seus Terrenos"}
            </span>
            <span className="text-sm font-bold text-primary bg-primary/10 px-3 py-1 rounded-full shrink-0">
              Total: {terrenos.reduce((acc, curr) => acc + (parseFloat(curr.sizeVal) || 0), 0)}{" "}
              {sizeUnit}
            </span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1.5 scrollbar-none">
            {terrenos.map((t) => {
              const isActive = t.id === activeId;
              return (
                <div key={t.id} className="relative flex items-center shrink-0 pr-1.5">
                  <button
                    type="button"
                    onClick={() => setActiveId(t.id)}
                    className={`h-11 px-4 rounded-xl text-sm font-bold border transition-all cursor-pointer ${
                      isActive
                        ? "bg-primary border-primary text-primary-foreground shadow-soft"
                        : "bg-soft border-border text-foreground/80 hover:bg-secondary"
                    }`}
                  >
                    {t.name} ({parseFloat(t.sizeVal) || 0} {t.sizeUnit})
                  </button>
                  {terrenos.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveTerreno(t.id)}
                      className="absolute -top-2 -right-1.5 w-7 h-7 rounded-full bg-destructive hover:bg-destructive/90 text-destructive-foreground text-sm font-extrabold flex items-center justify-center border border-border shadow-md cursor-pointer"
                      title={
                        language === "es" ? "Eliminar" : language === "en" ? "Delete" : "Excluir"
                      }
                    >
                      ✕
                    </button>
                  )}
                </div>
              );
            })}
            <button
              type="button"
              onClick={handleAddTerreno}
              className="h-11 px-4 rounded-xl text-sm font-bold border border-dashed border-primary text-primary hover:bg-primary/5 transition-all cursor-pointer shrink-0"
            >
              +{" "}
              {language === "es"
                ? "Añadir Terreno"
                : language === "en"
                  ? "Add Terrain"
                  : "Adicionar Terreno"}
            </button>
          </div>
        </div>

        {/* Method Tab selector */}
        <div className="flex rounded-xl bg-secondary p-1 border border-border shrink-0">
          <button
            type="button"
            onClick={() => setActiveMethod("draw")}
            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all cursor-pointer ${
              activeMethod === "draw"
                ? "bg-card text-foreground shadow-soft border border-border/40"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {language === "es"
              ? "Dibujar en el mapa"
              : language === "en"
                ? "Draw on Map"
                : "Desenhar no Mapa"}
          </button>
          <button
            type="button"
            onClick={() => setActiveMethod("upload")}
            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all cursor-pointer ${
              activeMethod === "upload"
                ? "bg-card text-foreground shadow-soft border border-border/40"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {language === "es"
              ? "Enviar archivo del CAR"
              : language === "en"
                ? "Upload CAR File"
                : "Enviar Arquivo do CAR"}
          </button>
        </div>

        {activeMethod === "draw" ? (
          /* Map placeholder */
          <button
            type="button"
            onClick={() => setMapOpen(true)}
            className="relative w-full h-44 rounded-2xl bg-secondary overflow-hidden border border-border active:scale-[0.995] transition-transform shrink-0 animate-in fade-in duration-200"
          >
            {/* faux satellite grid */}
            <div
              className="absolute inset-0 opacity-50"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(74,124,89,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(74,124,89,0.15) 1px, transparent 1px)",
                backgroundSize: "22px 22px",
              }}
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-navy px-4">
              <div className="w-12 h-12 rounded-full bg-card shadow-card flex items-center justify-center shrink-0">
                <MapPin size={22} className="text-primary" />
              </div>
              <span className="text-base font-bold">
                {points.length >= 3 ? t("cadastro.success") : t("cadastro.tap_map")}
              </span>
              {points.length > 0 && (
                <span className="text-sm text-primary font-bold">
                  {points.length} {points.length === 1 ? t("cadastro.point") : t("cadastro.points")}
                </span>
              )}
              {address && (
                <span className="text-sm text-foreground/80 truncate max-w-full font-medium">
                  {address}
                </span>
              )}
            </div>
          </button>
        ) : (
          /* File dropzone */
          <div className="flex flex-col gap-4 border border-dashed border-border bg-card rounded-2xl p-6 items-center justify-center text-center relative hover:bg-secondary/40 transition-colors shrink-0 min-h-[176px] animate-in fade-in duration-200">
            <input
              type="file"
              accept=".zip,.geojson,.json,.ret"
              className="absolute inset-0 opacity-0 cursor-pointer z-10"
              onChange={(e) => {
                const files = e.target.files;
                if (files && files.length > 0) {
                  handleFileUploadSimulated(files[0].name);
                }
              }}
              disabled={isUploadingFile}
            />
            {isUploadingFile ? (
              <div className="w-full flex flex-col items-center gap-3">
                <Loader2 className="animate-spin text-primary" size={32} />
                <span className="text-base font-bold text-foreground">{uploadStepText}</span>
                <div className="w-full h-2 rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            ) : uploadedFileName ? (
              <div className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-lg">
                  ✓
                </div>
                <span className="text-base font-bold text-foreground truncate max-w-[240px]">
                  {uploadedFileName}
                </span>
                <span className="text-sm text-muted-foreground">
                  {language === "es"
                    ? "Polígono del CAR cargado con éxito"
                    : language === "en"
                      ? "CAR polygon loaded successfully"
                      : "Polígono do CAR carregado com sucesso"}
                </span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-lg">
                  📁
                </div>
                <div className="space-y-1">
                  <p className="text-base font-bold text-foreground">
                    {language === "es"
                      ? "Subir archivo del CAR (.RET, shapefile, geojson)"
                      : language === "en"
                        ? "Upload CAR file (.RET, shapefile, geojson)"
                        : "Enviar arquivo do CAR (.RET, shapefile, geojson)"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {language === "es"
                      ? "Arrastra y suelta tu archivo aquí o haz clic para buscar"
                      : language === "en"
                        ? "Drag and drop your file here or click to browse"
                        : "Arraste e solte seu arquivo aqui ou clique para buscar"}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Form fields */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleConfirmCadastro();
          }}
          className="flex flex-col gap-4 flex-1"
        >
          <div className="flex flex-col gap-1.5">
            <label htmlFor="land-size" className="text-base font-bold text-foreground/90">
              {t("cadastro.size_label_v2")}
            </label>
            <div className="flex gap-2">
              <input
                id="land-size"
                type="number"
                min="0"
                step="any"
                value={sizeVal}
                onChange={(e) => setSizeVal(e.target.value)}
                className="h-12 flex-1 min-w-0 px-4 rounded-xl bg-soft border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-base w-full font-semibold"
              />
              <select
                id="land-size-unit"
                aria-label="Unidade de medida"
                value={sizeUnit}
                onChange={(e) => setSizeUnit(e.target.value as any)}
                className="h-12 w-44 shrink-0 px-3 rounded-xl bg-soft border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-base font-semibold cursor-pointer"
              >
                <option value="ha">{t("cadastro.unit_ha")}</option>
                <option value="alqueire_mg">{t("cadastro.unit_alqueire_mg")}</option>
                <option value="alqueire_sp">{t("cadastro.unit_alqueire_sp")}</option>
                <option value="modulo_fiscal">{t("cadastro.unit_modulo_fiscal")}</option>
              </select>
            </div>

            {/* Dynamic equivalency and classification panel */}
            {numericSize >= 0 && (
              <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-card flex flex-col gap-3 animate-in fade-in duration-200 mt-1">
                {/* Equivalency text */}
                {sizeUnit !== "ha" && (
                  <div className="text-sm text-foreground/90 font-semibold">
                    {t("cadastro.equiv_label").replace(
                      "{val}",
                      formattedHectares.toLocaleString(undefined, { maximumFractionDigits: 2 }),
                    )}
                  </div>
                )}

                {/* Classification badge and info */}
                <div className="flex flex-col items-start gap-2.5 w-full">
                  {farmerClass === "pequeno" ? (
                    <div className="px-3 py-1 rounded-full text-sm font-bold bg-primary/10 text-primary border border-primary/20 uppercase shrink-0">
                      {t("cadastro.class_pequeno")}
                    </div>
                  ) : farmerClass === "medio" ? (
                    <div className="px-3 py-1 rounded-full text-sm font-bold bg-amber-warn/10 text-amber-warn border border-amber-warn/20 uppercase shrink-0">
                      {t("cadastro.class_medio")}
                    </div>
                  ) : (
                    <div className="px-3 py-1 rounded-full text-sm font-bold bg-muted text-muted-foreground border border-border uppercase shrink-0">
                      {t("cadastro.class_grande")}
                    </div>
                  )}
                  <p className="text-sm text-foreground/80 leading-relaxed">
                    {farmerClass === "pequeno"
                      ? t("cadastro.class_pequeno_desc")
                      : farmerClass === "medio"
                        ? t("cadastro.class_medio_desc")
                        : t("cadastro.class_grande_desc")}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2.5 p-3.5 bg-soft/50 rounded-xl border border-border/40">
            <div className="flex justify-between items-center">
              <label htmlFor="car-number" className="text-sm font-bold text-foreground/90">
                {t("cadastro.car_number")}
              </label>
              <button
                type="button"
                onClick={handleFetchCarByArea}
                disabled={carSearching || points.length < 3}
                className="text-sm text-primary hover:underline font-bold flex items-center gap-1 active:scale-95 disabled:opacity-50 shrink-0"
              >
                {carSearching
                  ? `🔍 ${t("cadastro.searching")}`
                  : language === "es"
                    ? "🔍 Buscar en el área"
                    : language === "en"
                      ? "🔍 Search by area"
                      : "🔍 Buscar na área"}
              </button>
            </div>
            {carSearching && (
              <div className="text-sm text-foreground/80 bg-soft border border-border rounded-xl p-2.5 text-center animate-in fade-in duration-200">
                {language === "es"
                  ? "Consultando el backend. Esto puede tardar hasta 2 minutos..."
                  : language === "en"
                    ? "Querying the backend. This can take up to 2 minutes..."
                    : "Verificando dados. Pode levar até 2 minutos..."}
              </div>
            )}
            {carError && (
              <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-3.5 flex flex-col gap-2.5 mt-1 text-left animate-in fade-in duration-200">
                <span className="text-sm font-bold text-destructive flex items-center gap-1.5">
                  ⚠️ {carError}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleFetchCarByArea}
                    className="flex-1 h-9 rounded-lg bg-primary text-primary-foreground font-bold text-xs active:scale-95 transition-all shadow-soft cursor-pointer"
                  >
                    {t("cadastro.tentar_novamente")}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCarError("");
                      setCarOpen(true);
                      setTimeout(() => {
                        const input = document.getElementById("car-number");
                        if (input) {
                          input.focus();
                          input.scrollIntoView({ behavior: "smooth", block: "center" });
                        }
                      }, 100);
                    }}
                    className="flex-1 h-9 rounded-lg border border-border bg-card font-bold text-xs text-foreground/85 hover:bg-secondary active:scale-95 transition-all cursor-pointer"
                  >
                    {t("cadastro.preencher_manualmente")}
                  </button>
                </div>
              </div>
            )}

            {carsFound.length > 0 && !selectedCar ? (
              <div className="flex flex-col gap-2 p-2.5 bg-amber-warn/5 border border-amber-warn/20 rounded-xl animate-in fade-in duration-200">
                <span className="text-sm font-bold text-amber-warn flex items-center gap-1">
                  ⚠️{" "}
                  {language === "es"
                    ? `${carsFound.length} CAR(s) encontrado(s). Elige tu propriedade:`
                    : language === "en"
                      ? `${carsFound.length} CAR(s) found. Choose your property:`
                      : `${carsFound.length} CAR(s) encontrado(s). Escolha sua propriedade:`}
                </span>
                <div className="flex flex-col gap-1.5 max-h-[260px] overflow-y-auto pr-1">
                  {carsFound.map((car, idx) => {
                    const code = getCarCode(car, `CAR-${idx + 1}`);
                    const location = getCarLocation(car);
                    const area = getCarArea(car);
                    return (
                      <button
                        key={`${code}-${idx}`}
                        type="button"
                        onClick={() => handleSelectCar(car, idx)}
                        className="w-full text-left px-4 py-3 bg-card hover:bg-secondary rounded-xl border border-border text-base font-medium flex justify-between items-center gap-2 transition-all active:scale-[0.99] shadow-soft cursor-pointer"
                      >
                        <span className="flex flex-col min-w-0">
                          <span className="text-foreground font-semibold truncate">{code}</span>
                          {location && (
                            <span className="text-muted-foreground text-sm truncate">
                              {location}
                            </span>
                          )}
                        </span>
                        {area !== null && (
                          <span className="text-primary font-extrabold whitespace-nowrap text-sm">
                            {area.toFixed(2)} ha
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5 animate-in fade-in duration-200">
                <input
                  id="car-number"
                  value={carNumber}
                  onChange={(e) => {
                    setCarNumber(e.target.value);
                    setCarFound(!!e.target.value);
                    if (selectedCar) setSelectedCar(null);
                  }}
                  placeholder="Ex: BR-MG-3170107-..."
                  className="h-12 px-4 rounded-xl bg-soft border border-border outline-none text-base"
                />
                {selectedCar ? (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-primary font-bold">
                      {language === "es"
                        ? "CAR seleccionado y listo para guardar."
                        : language === "en"
                          ? "CAR selected and ready to save."
                          : "CAR selecionado e pronto para salvar."}
                    </span>
                    <button
                      type="button"
                      onClick={handleResetSelectedCar}
                      className="text-sm text-primary font-bold hover:underline"
                    >
                      {language === "es" ? "Cambiar" : language === "en" ? "Change" : "Trocar"}
                    </button>
                  </div>
                ) : (
                  carFound && (
                    <span className="text-sm text-primary font-bold animate-pulse">
                      {t("cadastro.car_found")}
                    </span>
                  )
                )}
              </div>
            )}
          </div>

          <div className="flex-1" />

          {ndviErrorData && (
            <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4 shadow-card flex flex-col gap-3 animate-in fade-in duration-200 mt-2 text-left shrink-0">
              <h4 className="font-bold text-sm text-destructive flex items-center gap-1.5">
                ⚠️ {t("cadastro.ndvi_error_title")}
              </h4>
              <p className="text-sm text-foreground/80 leading-relaxed">
                {t("cadastro.ndvi_error_desc")}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => confirmCadastro(false)}
                  className="flex-1 h-11 rounded-xl bg-primary text-primary-foreground font-bold text-sm active:scale-95 transition-all shadow-soft flex items-center justify-center cursor-pointer"
                >
                  {t("cadastro.tentar_novamente")}
                </button>
                <button
                  type="button"
                  onClick={() => confirmCadastro(true)}
                  className="flex-1 h-11 rounded-xl border border-border bg-card font-bold text-sm text-foreground/80 hover:bg-secondary active:scale-95 transition-all flex items-center justify-center cursor-pointer"
                >
                  {t("cadastro.prosseguir_sem_ndvi")}
                </button>
              </div>
            </div>
          )}

          {saveError && (
            <div className="text-sm text-destructive font-semibold bg-destructive/5 border border-destructive/20 rounded-xl p-2.5 text-center animate-in fade-in duration-200">
              {saveError}
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="h-14 rounded-2xl bg-primary text-primary-foreground font-semibold text-base active:scale-[0.99] shadow-soft shrink-0 disabled:opacity-60 cursor-pointer w-full"
          >
            {saving
              ? language === "es"
                ? "Creando tu cuenta..."
                : language === "en"
                  ? "Creating your account..."
                  : "Criando sua conta..."
              : t("cadastro.confirm_btn")}
          </button>
        </form>
      </div>

      {saving && (
        <div className="fixed inset-0 z-[70] bg-background/80 backdrop-blur-sm flex items-center justify-center px-6">
          <div className="w-full max-w-[320px] rounded-3xl bg-card border border-border shadow-2xl p-5 flex flex-col items-center gap-4 text-center">
            <Loader2 size={28} className="animate-spin text-primary" />
            <div className="space-y-1 w-full">
              <p className="text-lg font-bold text-foreground">
                {savingStepText ||
                  (language === "es"
                    ? "Creando tu cuenta..."
                    : language === "en"
                      ? "Creating your account..."
                      : "Criando sua conta...")}
              </p>
              <div className="w-full h-2.5 rounded-full bg-secondary overflow-hidden mt-3">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-300"
                  style={{ width: `${savingProgress}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed mt-2.5 pt-1">
                {language === "es"
                  ? "Analizando 12 meses de imágenes de satélite. Esto puede tardar hasta 1 minuto."
                  : language === "en"
                    ? "Analyzing 12 months of satellite imagery. This can take up to 1 minute."
                    : "Analisando 12 meses de imagens de satélite. Isso pode levar até 1 minuto."}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Expanded Map Drawer Overlay */}
      {mapOpen && (
        <div className="fixed inset-0 z-50 bg-background flex flex-col animate-in slide-in-from-bottom duration-300">
          <header className="px-5 pt-5 pb-3 flex items-center gap-3 border-b border-border bg-card shadow-sm shrink-0">
            <button
              type="button"
              onClick={() => setMapOpen(false)}
              className="p-1.5 hover:bg-secondary rounded-lg text-navy shrink-0"
            >
              <ChevronLeft size={22} />
            </button>
            <h2 className="text-lg font-bold text-foreground">{t("cadastro.map_title")}</h2>
          </header>

          <div className="p-5 flex flex-col gap-4 flex-1 overflow-y-auto">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="map-search-address" className="text-sm font-bold text-foreground/90">
                {t("cadastro.address_label")}
              </label>
              <div className="relative">
                <input
                  id="map-search-address"
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleSearchAddress();
                    }
                  }}
                  placeholder={t("cadastro.address_placeholder")}
                  className="h-12 pl-4 pr-12 rounded-xl bg-soft border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-base w-full"
                />
                <button
                  type="button"
                  onClick={handleSearchAddress}
                  disabled={searchingAddress || !address.trim()}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg text-muted-foreground hover:text-primary active:scale-95 disabled:opacity-40 transition-all cursor-pointer flex items-center justify-center"
                  title={
                    language === "es"
                      ? "Buscar en el mapa"
                      : language === "en"
                        ? "Search on map"
                        : "Buscar no mapa"
                  }
                >
                  {searchingAddress ? (
                    <span className="block w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                  ) : (
                    <Search size={18} />
                  )}
                </button>
              </div>
              {searchAddressError && (
                <p className="text-sm font-semibold text-destructive animate-in fade-in duration-200 mt-0.5">
                  ⚠️ {searchAddressError}
                </p>
              )}
            </div>

            <div className="flex-1 flex flex-col gap-2 min-h-[240px]">
              <label className="text-sm font-bold text-foreground/90 flex items-center justify-between">
                <span>{t("cadastro.outline_label")}</span>
                <span className="text-sm text-foreground/75 font-semibold">
                  {points.length} {points.length === 1 ? t("cadastro.point") : t("cadastro.points")}
                </span>
              </label>

              <div className="relative flex-1 rounded-2xl overflow-hidden border border-border select-none min-h-[260px] bg-secondary">
                <Suspense
                  fallback={
                    <div className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-muted-foreground bg-soft/40">
                      {language === "es"
                        ? "Cargando mapa..."
                        : language === "en"
                          ? "Loading map..."
                          : "Carregando mapa..."}
                    </div>
                  }
                >
                  <FarmMap points={points} setPoints={setPoints} center={mapCenter} />
                </Suspense>
              </div>
            </div>

            <div className="flex shrink-0">
              <button
                type="button"
                onClick={() => {
                  setMapOpen(false);
                  if (points.length >= 3) {
                    handleFetchCarByArea();
                  }
                }}
                className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-bold text-base flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
              >
                {t("cadastro.confirm_land_btn")}
              </button>
            </div>
          </div>
        </div>
      )}
    </MobileFrame>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-foreground/80">{label}</span>
      {children}
    </label>
  );
}

function Select({
  value,
  onChange,
  options,
  displayMap,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  displayMap?: Record<string, string>;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-12 w-full appearance-none px-4 pr-10 rounded-xl bg-soft border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-base"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {displayMap ? displayMap[o] : o}
          </option>
        ))}
      </select>
      <ChevronDown
        size={18}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
      />
    </div>
  );
}
