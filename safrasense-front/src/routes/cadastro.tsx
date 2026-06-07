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

const BUSCAR_CARS_ENDPOINT = "http://localhost:8000/buscar-cars";
const NDVI_ENDPOINT = "http://localhost:8000/ndvi";

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
  const [crops, setCrops] = useState<string[]>(["Milho"]);
  const [system, setSystem] = useState("Safrinha");

  const [showSystemInfo, setShowSystemInfo] = useState(false);

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
      crops: ["Milho"],
      system: "Safrinha",
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
      setCrops(active.crops || ["Milho"]);
      setSystem(active.system || "Safrinha");
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
              crops,
              system,
            }
          : t,
      ),
    );
  }, [points, address, sizeVal, sizeUnit, carNumber, selectedCar, crops, system, activeId]);

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

  const handleConfirmCadastro = async () => {
    setSaveError("");
    setSaving(true);

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

      const terrenosComNdvi = await Promise.all(
        finalTerrenos.map(async (terreno) => {
          const carPolygon = extractCarPolygon(terreno.selectedCar);
          const polygonForNdvi = carPolygon.length >= 3 ? carPolygon : terreno.points;

          if (polygonForNdvi.length < 3) {
            return {
              ...terreno,
              ndviHistorico12m: [],
              ndviRelatorioSemanal: [],
              ndviRelatorioMensal: [],
              ndviDataFinal: dataFinalNdvi,
              ndviFontePoligono: carPolygon.length >= 3 ? "car" : "demarcacao",
            };
          }

            const ndviDataset = await fetchNdviHistory(polygonForNdvi, dataFinalNdvi);
            const ndviHistorico12m =
              ndviDataset.monthly.length > 0 ? ndviDataset.monthly : ndviDataset.all.slice(-12);

          return {
            ...terreno,
            ndviHistorico12m,
            ndviRelatorioSemanal: ndviDataset.weekly,
            ndviRelatorioMensal: ndviDataset.monthly,
            ndviDataFinal: dataFinalNdvi,
            ndviFontePoligono: carPolygon.length >= 3 ? "car" : "demarcacao",
          };
        }),
      );

      const firstTerreno = terrenosComNdvi[0];

      const nextFarmer = {
        ...state.farmer,
        crop: `${crops.join(" + ")} (${system})`,
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
          produtosCultivados: crops,
          sistema: system,
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
    } catch (error) {
      console.error(error);
      setSaveError(
        language === "es"
          ? "No se pudo guardar tu registro. Intenta nuevamente."
          : language === "en"
            ? "Could not save your registration. Please try again."
            : "Não foi possível salvar seu cadastro. Tente novamente.",
      );
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

        {/* Map placeholder */}
        <button
          type="button"
          onClick={() => setMapOpen(true)}
          className="relative w-full h-44 rounded-2xl bg-secondary overflow-hidden border border-border active:scale-[0.995] transition-transform shrink-0"
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

        {/* Form fields */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <span className="text-base font-bold text-foreground/90">
              {t("cadastro.crops_grown")}
            </span>
            <div className="flex flex-wrap gap-2">
              {[
                "Milho",
                "Soja",
                "Café",
                "Feijão",
                "Cana-de-açúcar",
                "Laranja",
                "Batata",
                "Mandioca",
                "Algodão",
                "Outro",
              ].map((c) => {
                const active = crops.includes(c);
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      if (active) {
                        if (crops.length > 1) {
                          setCrops(crops.filter((x) => x !== c));
                        }
                      } else {
                        setCrops([...crops, c]);
                      }
                    }}
                    className={`h-11 px-4 rounded-xl text-base font-semibold border active:scale-95 transition-all flex items-center gap-1.5 ${
                      active
                        ? "bg-primary border-primary text-primary-foreground shadow-soft"
                        : "bg-soft border-border text-foreground/80 hover:bg-secondary"
                    }`}
                  >
                    {active && <span>✓</span>}
                    {t("crops." + c)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-foreground/90">
                {t("cadastro.system")}
              </span>
              <button
                type="button"
                onClick={() => setShowSystemInfo(!showSystemInfo)}
                className="text-muted-foreground hover:text-primary transition-colors flex items-center justify-center p-0.5 rounded-full hover:bg-secondary shrink-0"
                aria-label="Mais informações sobre o sistema"
              >
                <Info size={16} />
              </button>
            </div>
            <Select
              value={system}
              onChange={setSystem}
              options={["Primeira safra", "Safrinha", "Rotação"]}
              displayMap={{
                "Primeira safra": t("cadastro.first_harvest"),
                Safrinha: t("cadastro.second_harvest"),
                Rotação: t("cadastro.rotation"),
              }}
            />
            {showSystemInfo && (
              <div className="rounded-xl bg-primary/5 border border-primary/20 p-3.5 mt-1 text-sm text-foreground/90 flex flex-col gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
                <div>
                  <strong className="text-primary">{t("cadastro.first_harvest")}:</strong>{" "}
                  {t("cadastro.first_harvest_desc")}
                </div>
                <div>
                  <strong className="text-primary">{t("cadastro.second_harvest")}:</strong>{" "}
                  {t("cadastro.second_harvest_desc")}
                </div>
                <div>
                  <strong className="text-primary">{t("cadastro.rotation")}:</strong>{" "}
                  {t("cadastro.rotation_desc")}
                </div>
              </div>
            )}
          </div>

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
                className="h-12 flex-1 px-4 rounded-xl bg-soft border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-base w-full font-semibold"
              />
              <select
                id="land-size-unit"
                aria-label="Unidade de medida"
                value={sizeUnit}
                onChange={(e) => setSizeUnit(e.target.value as any)}
                className="h-12 w-48 px-3 rounded-xl bg-soft border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-base font-semibold cursor-pointer"
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
                    <div className="px-3 py-1 rounded-full text-sm font-bold bg-stone-100 text-stone-700 border border-stone-200 uppercase shrink-0">
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
              <div className="text-sm font-bold text-destructive bg-destructive/5 border border-destructive/20 rounded-xl p-2.5 text-center animate-in fade-in duration-200 mt-1">
                ⚠️ {carError}
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
              )
            }
          </div>
        </div>

        <div className="flex-1" />

        {saveError && (
          <div className="text-sm text-destructive font-semibold bg-destructive/5 border border-destructive/20 rounded-xl p-2.5 text-center animate-in fade-in duration-200">
            {saveError}
          </div>
        )}

        <button
          onClick={handleConfirmCadastro}
          disabled={saving}
          className="h-14 rounded-2xl bg-primary text-primary-foreground font-semibold text-base active:scale-[0.99] shadow-soft shrink-0 disabled:opacity-60"
        >
          {saving
            ? language === "es"
              ? "Creando tu cuenta..."
              : language === "en"
                ? "Creating your account..."
                : "Criando sua conta..."
            : t("cadastro.confirm_btn")}
        </button>
      </div>

      {saving && (
        <div className="fixed inset-0 z-[70] bg-background/80 backdrop-blur-sm flex items-center justify-center px-6">
          <div className="w-full max-w-[320px] rounded-3xl bg-card border border-border shadow-2xl p-5 flex flex-col items-center gap-4 text-center">
            <Loader2 size={28} className="animate-spin text-primary" />
            <div className="space-y-1">
              <p className="text-lg font-bold text-foreground">
                {language === "es"
                  ? "Creando tu cuenta..."
                  : language === "en"
                    ? "Creating your account..."
                    : "Criando sua conta..."}
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {language === "es"
                  ? "Un momento mientras validamos tu cuenta."
                  : language === "en"
                    ? "We are validating your account."
                    : "Aguarde um momento enquanto finalizamos seu cadastro."}
              </p>
            </div>
            <div className="w-full h-2 rounded-full bg-secondary overflow-hidden">
              <div className="h-full w-1/2 rounded-full bg-primary animate-pulse" />
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
                  title={language === "es" ? "Buscar en el mapa" : language === "en" ? "Search on map" : "Buscar no mapa"}
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
                <div className="absolute top-3 left-3 z-[500] bg-navy/85 backdrop-blur text-navy-foreground text-sm px-3.5 py-2 rounded-lg shadow pointer-events-none">
                  {t("cadastro.map_helper")}
                </div>

                <Suspense
                  fallback={
                    <div className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-muted-foreground bg-soft/40">
                      {language === "es" ? "Cargando mapa..." : language === "en" ? "Loading map..." : "Carregando mapa..."}
                    </div>
                  }
                >
                  <FarmMap points={points} setPoints={setPoints} center={mapCenter} />
                </Suspense>

                {points.length === 0 && (
                  <div className="absolute inset-x-4 bottom-4 z-[500] rounded-xl bg-card/95 backdrop-blur px-3.5 py-2.5 text-sm font-bold text-navy shadow pointer-events-none text-center">
                    {t("cadastro.map_empty")}
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setPoints([])}
                disabled={points.length === 0}
                className="h-12 px-4 rounded-xl border border-border font-bold text-sm text-foreground/80 hover:bg-secondary active:scale-95 transition-all disabled:opacity-40"
              >
                {t("cadastro.clear_btn")}
              </button>
              <button
                type="button"
                onClick={() => setPoints(points.slice(0, -1))}
                disabled={points.length === 0}
                className="h-12 px-4 rounded-xl border border-border font-bold text-sm text-foreground/80 hover:bg-secondary active:scale-95 transition-all disabled:opacity-40"
              >
                {t("cadastro.undo_btn")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMapOpen(false);
                  if (points.length >= 3) {
                    handleFetchCarByArea();
                  }
                }}
                className="flex-1 h-12 rounded-xl bg-primary text-primary-foreground font-bold text-base flex items-center justify-center gap-1.5 active:scale-95 transition-all"
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
