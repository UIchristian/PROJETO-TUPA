import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Droplets,
  Info,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  Waves,
  Wrench,
  ChevronRight,
  X,
} from "lucide-react";
import { MobileFrame } from "@/components/MobileFrame";
import { useAppState, appStore } from "@/lib/app-store";
import { t, useTranslation } from "@/lib/i18n";
import {
  getDiagnostico,
  getLayers,
  getHidrografia,
} from "@/api";
import type {
  Imovel,
  Diagnostico,
  GeoJSONGeometry,
  HidrografiaData,
  LayerGeometries,
} from "@/types/imovel";
import type { Terreno } from "@/lib/app-store";

const TupaMap = lazy(() => import("@/components/TupaMap"));

// Build a minimal LayerGeometries from local terreno data when PostGIS data
// isn't available yet (municipality not pre-computed, or backend offline).
const EMPTY_GEOM: GeoJSONGeometry = { type: "Polygon", coordinates: [] };

function buildFallbackLayers(terreno: Terreno): LayerGeometries | null {
  // Prefer the geometry from the CAR shapefile search result
  const carGeom = terreno.selectedCar?.geometry;
  if (carGeom?.coordinates?.length > 0) {
    return {
      poligonoDeclarado: {
        type: (carGeom.type as GeoJSONGeometry["type"]) ?? "Polygon",
        coordinates: carGeom.coordinates,
      },
      app: EMPTY_GEOM,
      divergencias: [],
      coberturaPoligonos: [],
    };
  }
  // Fallback to manually drawn points
  if (terreno.points.length >= 3) {
    return {
      poligonoDeclarado: {
        type: "Polygon",
        coordinates: [terreno.points.map((p) => [p.lng, p.lat])],
      },
      app: EMPTY_GEOM,
      divergencias: [],
      coberturaPoligonos: [],
    };
  }
  return null;}

export const Route = createFileRoute("/diagnostico")({
  head: () => {
    const lang = appStore.get().language || "pt";
    return {
      meta: [
        { title: t("diagnostico.headTitle", lang) },
        { name: "description", content: t("diagnostico.title", lang) },
      ],
    };
  },
  component: DiagnosticoScreen,
});

function DiagnosticoScreen() {
  const navigate = useNavigate();
  const { t, language } = useTranslation();
  const { activeTerrenoId, farmer } = useAppState();

  // Only terrenos with a CAR number can have a diagnostico
  const userTerrenos = farmer.terrenos?.filter((t) => t.carNumber) ?? [];

  // Find the active terreno from the store
  const activeTerreno =
    userTerrenos.find((t) => t.id === activeTerrenoId) ?? userTerrenos[0];

  // PostGIS imovel ID is derived from the CAR number
  const activeImovelId = activeTerreno?.carNumber
    ? `imovel_${activeTerreno.carNumber}`
    : null;

  // Build a typed Imovel from the terreno data (no API call needed for identity info)
  const selectedImovel: Imovel | null = activeTerreno
    ? {
        id: activeImovelId ?? activeTerreno.id,
        nome: activeTerreno.name,
        municipio: activeTerreno.address.split(",")[0]?.trim() || "",
        uf: activeTerreno.address.split(",")[1]?.trim() || "MG",
        areaHectares: activeTerreno.hectares || 0,
        numeroCAR: activeTerreno.carNumber,
        poligonoDeclarado: { type: "Polygon", coordinates: [] },
      }
    : null;

  const [diagnostico, setDiagnostico] = useState<Diagnostico | null>(null);
  const [layers, setLayers] = useState<LayerGeometries | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  // Hidrografia panel
  const [showHidroPanel, setShowHidroPanel] = useState(false);
  const [hidro, setHidro] = useState<HidrografiaData | null>(null);
  const [hidoLoading, setHidroLoading] = useState(false);

  // Map layer controls
  const [showDeclared, setShowDeclared] = useState(true);
  const [showApp, setShowApp] = useState(true);
  const [showRestrito, setShowRestrito] = useState(true);
  const [showUsoCobertura, setShowUsoCobertura] = useState(true);
  const [showDivergencias, setShowDivergencias] = useState(true);

  useEffect(() => {
    document.title = t("diagnostico.headTitle");
  }, [t, language]);

  // Fetch diagnostico and layers whenever the active imovel changes
  useEffect(() => {
    if (!activeImovelId) return;
    async function loadData() {
      try {
        setLoading(true);
        setError(false);
        setHidro(null);
        const [diag, lay] = await Promise.all([
          getDiagnostico(activeImovelId!),
          getLayers(activeImovelId!),
        ]);
        setDiagnostico(diag);
        setLayers(lay);
      } catch (err) {
        console.error(err);
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [activeImovelId]);

  const handleTerrenoChange = (id: string) => {
    appStore.setActiveTerreno(id);
  };

  const handleOpenHidro = async () => {
    setShowHidroPanel(true);
    if (hidro || hidoLoading) return;
    setHidroLoading(true);
    try {
      const data = await getHidrografia(activeImovelId!);
      setHidro(data);
    } catch (e) {
      console.error(e);
    } finally {
      setHidroLoading(false);
    }
  };

  // Styling helpers for compliance score
  const score = diagnostico?.scoreConformidade ?? 100;
  const scoreBadgeColors =
    score >= 90
      ? "bg-primary/10 border-primary/20 text-primary"
      : score >= 60
        ? "bg-amber-warn/10 border-amber-warn/20 text-amber-warn"
        : "bg-destructive/10 border-destructive/20 text-destructive";

  const statusLabel =
    score >= 90
      ? t("diagnostico.regular")
      : score >= 60
        ? t("diagnostico.atencao")
        : t("diagnostico.critico");

  // Empty state: user hasn't registered any property with a CAR yet
  if (!activeTerreno) {
    return (
      <MobileFrame withNav>
        <div className="flex-1 flex flex-col min-h-screen bg-background text-foreground">
          <header className="px-5 pt-5 pb-3 border-b border-border bg-card shadow-soft shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <ShieldCheck className="text-primary w-5 h-5" />
              </div>
              <h1 className="text-lg font-bold text-foreground">Tupã</h1>
            </div>
          </header>
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-6">
            <ShieldAlert className="w-16 h-16 text-muted-foreground" />
            <div className="space-y-2">
              <h2 className="text-lg font-extrabold text-foreground">
                Nenhuma propriedade cadastrada
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-[280px]">
                Cadastre sua propriedade com um número de CAR para ver o
                diagnóstico ambiental.
              </p>
            </div>
            <button
              onClick={() => navigate({ to: "/cadastro" })}
              className="px-6 py-3 bg-primary text-primary-foreground font-bold rounded-xl hover:opacity-90 active:scale-95 transition-all cursor-pointer"
            >
              Ir para Cadastro
            </button>
          </div>
        </div>
      </MobileFrame>
    );
  }

  return (
    <MobileFrame withNav>
      <div className="flex-1 flex flex-col min-h-screen bg-background text-foreground">
        {/* Top Header */}
        <header className="px-5 pt-5 pb-3 border-b border-border bg-card shadow-soft shrink-0">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <ShieldCheck className="text-primary w-5 h-5" />
              </div>
              <h1 className="text-lg font-bold text-foreground">Tupã</h1>
            </div>

            {/* Lang Selector */}
            <div className="flex gap-2">
              {(["es", "pt", "en"] as const).map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => appStore.set({ language: lang })}
                  className={`px-2 py-1 rounded text-xs font-bold transition-all ${
                    language === lang
                      ? "bg-primary text-primary-foreground scale-105"
                      : "bg-soft text-muted-foreground hover:bg-secondary"
                  }`}
                >
                  {lang.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </header>

        {/* Loading State */}
        {loading && (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-background min-h-[60vh]">
            <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
            <p className="text-sm font-semibold text-muted-foreground">
              {t("diagnostico.loading")}
            </p>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-background min-h-[60vh]">
            <ShieldAlert className="w-14 h-14 text-destructive mb-4" />
            <h2 className="text-lg font-bold mb-2">{t("diagnostico.errorLoading")}</h2>
            <button
              onClick={() => activeImovelId && handleTerrenoChange(activeTerreno.id)}
              className="mt-2 px-5 py-2.5 bg-primary text-primary-foreground font-bold text-sm rounded-xl hover:opacity-90 active:scale-95 transition-all cursor-pointer"
            >
              {t("cadastro.tentar_novamente")}
            </button>
          </div>
        )}

        {/* Main Content Area */}
        {!loading && !error && selectedImovel && (
          <div className="flex-1 p-5 flex flex-col gap-5 pb-24 overflow-y-auto no-scrollbar">
            {/* Property Selector Card */}
            <div className="rounded-2xl border border-border bg-card p-4 shadow-card flex flex-col gap-3">
              <div className="flex flex-col gap-1 text-left">
                <span className="text-xs uppercase font-bold tracking-wider text-muted-foreground">
                  {t("profile.propertySection")}
                </span>

                {userTerrenos.length > 1 ? (
                  <div className="relative w-full mt-1">
                    <select
                      value={activeTerreno.id}
                      onChange={(e) => handleTerrenoChange(e.target.value)}
                      className="bg-soft hover:bg-secondary border border-border rounded-xl pl-3 pr-9 py-2 text-base font-bold text-foreground outline-none cursor-pointer appearance-none w-full transition-all truncate"
                    >
                      {userTerrenos.map((terreno) => (
                        <option key={terreno.id} value={terreno.id}>
                          {terreno.name}
                        </option>
                      ))}
                    </select>
                    <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-muted-foreground">
                      <ChevronDown size={18} />
                    </div>
                  </div>
                ) : (
                  <h2 className="text-lg font-bold text-foreground mt-0.5">
                    {selectedImovel.nome}
                  </h2>
                )}
              </div>

              {/* Property Identifiers Row */}
              <div className="grid grid-cols-2 gap-2 text-sm border-t border-border/40 pt-3 text-left">
                <div className="flex flex-col">
                  <span className="text-xs text-muted-foreground font-semibold">CAR</span>
                  <span
                    className="font-bold text-foreground truncate"
                    title={selectedImovel.numeroCAR}
                  >
                    {selectedImovel.numeroCAR}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs text-muted-foreground font-semibold">
                    {language === "en" ? "Location" : "Localização"}
                  </span>
                  <span className="font-bold text-foreground">
                    {selectedImovel.municipio} - {selectedImovel.uf}
                  </span>
                </div>
                <div className="flex flex-col mt-2">
                  <span className="text-xs text-muted-foreground font-semibold">Area</span>
                  <span className="font-bold text-foreground">
                    {selectedImovel.areaHectares} ha
                  </span>
                </div>
              </div>
            </div>

            {/* Score Highlight Box */}
            <div className="rounded-2xl border border-border bg-card p-4 shadow-card flex items-center justify-between gap-4">
              <div className="flex-1 text-left flex flex-col gap-1">
                <span className="text-xs uppercase font-bold tracking-wider text-muted-foreground">
                  {t("diagnostico.scoreLabel")}
                </span>
                <span className="text-xl font-bold tracking-tight">{statusLabel}</span>
              </div>
              <div
                className={`w-16 h-16 rounded-full border-2 flex flex-col items-center justify-center font-extrabold text-lg tracking-tight shrink-0 shadow-soft ${scoreBadgeColors}`}
              >
                {score}
              </div>
            </div>

            {/* Leaflet Map Widget Container */}
            <div className="w-full h-[280px] rounded-2xl overflow-hidden shadow-soft shrink-0 border border-border">
              <Suspense
                fallback={
                  <div className="w-full h-full flex items-center justify-center bg-soft text-sm text-muted-foreground font-bold">
                    <Loader2 className="w-6 h-6 animate-spin text-primary mr-2" />
                    {t("diagnostico.loading")}
                  </div>
                }
              >
                {!import.meta.env.SSR && (
                  <TupaMap
                    imovel={selectedImovel}
                    layers={layers ?? buildFallbackLayers(activeTerreno) ?? { poligonoDeclarado: EMPTY_GEOM, app: EMPTY_GEOM, divergencias: [], coberturaPoligonos: [] }}
                    showDeclared={showDeclared}
                    showApp={showApp}
                    showRestrito={showRestrito}
                    showUsoCobertura={showUsoCobertura}
                    showDivergencias={showDivergencias}
                  />
                )}
              </Suspense>
            </div>

            {/* Layer Control — below the map */}
            <div className="rounded-2xl border border-border bg-card p-4 shadow-card text-left">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                <Info size={13} className="text-primary shrink-0" />
                {t("diagnostico.layerControlTitle")}
              </h3>
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                <label className="flex items-center gap-2 font-semibold text-sm cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showDeclared}
                    onChange={() => setShowDeclared(!showDeclared)}
                    className="rounded accent-primary w-4 h-4 cursor-pointer shrink-0"
                  />
                  <span className="w-4 h-1.5 bg-primary rounded-sm inline-block shrink-0" />
                  <span>{t("diagnostico.layerDeclared")}</span>
                </label>
                <label className="flex items-center gap-2 font-semibold text-sm cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showApp}
                    onChange={() => setShowApp(!showApp)}
                    className="rounded accent-primary w-4 h-4 cursor-pointer shrink-0"
                  />
                  <span className="w-4 h-1.5 border border-dashed border-[#3b82f6] bg-[#3b82f6]/20 rounded-sm inline-block shrink-0" />
                  <span>{t("diagnostico.layerApp")}</span>
                </label>
                {layers?.usoRestrito && (
                  <label className="flex items-center gap-2 font-semibold text-sm cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={showRestrito}
                      onChange={() => setShowRestrito(!showRestrito)}
                      className="rounded accent-primary w-4 h-4 cursor-pointer shrink-0"
                    />
                    <span className="w-4 h-1.5 border border-dashed border-[#c68a35] bg-[#c68a35]/20 rounded-sm inline-block shrink-0" />
                    <span>{t("diagnostico.layerUsoRestrito")}</span>
                  </label>
                )}
                <label className="flex items-center gap-2 font-semibold text-sm cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showUsoCobertura}
                    onChange={() => setShowUsoCobertura(!showUsoCobertura)}
                    className="rounded accent-primary w-4 h-4 cursor-pointer shrink-0"
                  />
                  <span className="w-4 h-1.5 bg-[#EAB308]/60 rounded-sm inline-block shrink-0" />
                  <span>{t("diagnostico.layerUsoCobertura")}</span>
                </label>
                <label className="flex items-center gap-2 font-semibold text-sm cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showDivergencias}
                    onChange={() => setShowDivergencias(!showDivergencias)}
                    className="rounded accent-primary w-4 h-4 cursor-pointer shrink-0"
                  />
                  <span className="w-4 h-1.5 bg-[#ef4444] rounded-sm inline-block shrink-0" />
                  <span>{t("diagnostico.layerDivergencia")}</span>
                </label>
              </div>
            </div>

            {/* Hidrografia Button */}
            <button
              onClick={handleOpenHidro}
              className="w-full flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 shadow-card hover:bg-soft active:scale-[0.98] transition-all cursor-pointer text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
                  <Droplets className="w-5 h-5 text-blue-500" />
                </div>
                <div className="flex flex-col">
                  <span className="font-bold text-sm text-foreground">Bacias Hidrográficas</span>
                  <span className="text-xs text-muted-foreground">Cursos d'água na região do imóvel</span>
                </div>
              </div>
              <ChevronRight size={18} className="text-muted-foreground shrink-0" />
            </button>

            {/* Land Cover Classification breakdown */}
            <div className="rounded-2xl border border-border bg-card p-4 shadow-card flex flex-col gap-3 text-left">
              <h3 className="font-bold text-base text-foreground flex items-center gap-1.5">
                🗺️ {t("diagnostico.coverageTitle")}
              </h3>

              {(!diagnostico?.coberturaSolo || diagnostico.coberturaSolo.length === 0) ? (
                <p className="text-sm text-muted-foreground py-2">
                  Dados de cobertura ainda não disponíveis para este município.
                </p>
              ) : (
                <div className="flex flex-col gap-3 mt-1.5">
                  {diagnostico.coberturaSolo.map((item, idx) => (
                    <div key={idx} className="flex flex-col gap-1 text-sm font-semibold">
                      <div className="flex justify-between items-center text-foreground/90">
                        <span className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full inline-block shrink-0"
                            style={{ backgroundColor: item.corHex }}
                          />
                          {item.classe}
                        </span>
                        <span className="tabular-nums font-bold">{item.percentual}%</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-soft overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${item.percentual}%`,
                            backgroundColor: item.corHex,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Divergences list / CAR Compliance Box */}
            <div className="flex flex-col gap-3 text-left">
              {diagnostico?.divergencias && diagnostico.divergencias.length > 0 ? (
                <>
                  <div className="flex items-center gap-2 px-1 font-bold text-base text-destructive">
                    <AlertTriangle size={18} />
                    <span>
                      {t("diagnostico.divergencesCount", {
                        count: diagnostico.divergencias.length,
                      })}
                    </span>
                  </div>

                  <div className="flex flex-col gap-4">
                    {diagnostico.divergencias.map((div) => {
                      const severityBadge =
                        div.severidade === "alta"
                          ? "bg-destructive/10 text-destructive border-destructive/20"
                          : "bg-amber-warn/10 text-amber-warn border-amber-warn/20";

                      const severityLabel =
                        div.severidade === "alta"
                          ? t("diagnostico.divergenceSeverityHigh")
                          : t("diagnostico.divergenceSeverityMedium");

                      return (
                        <div
                          key={div.id}
                          className="rounded-2xl border border-border bg-card p-4 shadow-card flex flex-col gap-3.5"
                        >
                          {/* Title & Severity */}
                          <div className="flex justify-between items-start gap-2.5">
                            <h4 className="font-extrabold text-base leading-tight text-foreground/90 flex-1">
                              {div.tipo}
                            </h4>
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-xs font-bold border shrink-0 uppercase tracking-wide ${severityBadge}`}
                            >
                              {severityLabel}
                            </span>
                          </div>

                          {/* Affected Area */}
                          <div className="text-sm font-bold text-muted-foreground flex items-center gap-1 bg-soft/50 px-2.5 py-1 rounded-lg self-start">
                            <span>📐</span>
                            <span>
                              {t("diagnostico.divergenceArea", { area: div.areaHectares })}
                            </span>
                          </div>

                          {/* Simple explanation */}
                          <p className="text-sm text-foreground/85 leading-relaxed bg-soft/20 p-2.5 rounded-xl border border-border/30">
                            {div.textoLinguagemSimples}
                          </p>

                          {/* Remediation steps */}
                          <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 flex flex-col gap-2">
                            <span className="text-xs uppercase font-extrabold tracking-wider text-primary flex items-center gap-1.5">
                              <Wrench size={14} />
                              {t("diagnostico.rectificationPath")}
                            </span>
                            <p className="text-sm text-foreground/90 leading-relaxed font-semibold">
                              {div.caminhoRetificacao}
                            </p>
                          </div>

                          {/* Remediation button */}
                          <button
                            onClick={() => navigate({ to: "/retificacao" })}
                            className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:opacity-95 transition-all flex items-center justify-center gap-1.5 shadow-soft active:scale-[0.98] cursor-pointer mt-1"
                          >
                            <Wrench size={16} />
                            {t("diagnostico.btnRectify")}
                            <ChevronRight size={16} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                /* Compliant Safe State Card */
                <div className="rounded-2xl border border-border bg-card p-5 shadow-card flex flex-col items-center gap-4 text-center">
                  <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-primary shadow-soft">
                    <CheckCircle2 size={32} />
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-extrabold text-base text-foreground">
                      {t("diagnostico.regular")}
                    </h4>
                    <p className="text-sm text-muted-foreground leading-relaxed max-w-[260px]">
                      {t("diagnostico.noDivergences")}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Hidrografia Bottom Sheet */}
      {showHidroPanel && (
        <div className="fixed inset-0 z-[2000] flex flex-col justify-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowHidroPanel(false)}
          />

          {/* Panel */}
          <div className="relative bg-card rounded-t-3xl shadow-2xl max-h-[80vh] flex flex-col animate-in slide-in-from-bottom duration-300">
            {/* Handle + Header */}
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-border shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Waves className="w-4 h-4 text-blue-500" />
                </div>
                <div>
                  <h2 className="font-extrabold text-base text-foreground">Bacias Hidrográficas</h2>
                  <p className="text-xs text-muted-foreground">Cursos d'água que interceptam o imóvel</p>
                </div>
              </div>
              <button
                onClick={() => setShowHidroPanel(false)}
                className="w-8 h-8 rounded-full bg-soft flex items-center justify-center hover:bg-secondary transition-colors cursor-pointer"
              >
                <X size={16} className="text-muted-foreground" />
              </button>
            </div>

            {/* Body */}
            <div className="overflow-y-auto flex-1 p-5 flex flex-col gap-4 no-scrollbar">
              {hidoLoading && (
                <div className="flex items-center justify-center py-10 gap-3">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                  <span className="text-sm font-semibold text-muted-foreground">Consultando banco espacial…</span>
                </div>
              )}

              {!hidoLoading && hidro && (
                <>
                  {/* Summary badge */}
                  <div className="flex items-center gap-3 bg-blue-500/8 border border-blue-500/20 rounded-2xl p-3.5">
                    <Droplets className="w-8 h-8 text-blue-500 shrink-0" />
                    <div>
                      <p className="font-extrabold text-lg text-foreground leading-none">
                        {hidro.totalCursos}
                      </p>
                      <p className="text-xs text-muted-foreground font-semibold mt-0.5">
                        {hidro.totalCursos === 1 ? "curso d'água encontrado" : "cursos d'água encontrados"}
                      </p>
                    </div>
                  </div>

                  {hidro.totalCursos === 0 && (
                    <div className="text-center py-6 text-sm text-muted-foreground font-semibold">
                      Nenhum curso d'água intercepta este imóvel.
                    </div>
                  )}

                  {hidro.cursos.map((curso, i) => (
                    <div
                      key={curso.id}
                      className="rounded-2xl border border-border bg-soft/40 p-4 flex flex-col gap-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-blue-500/15 text-blue-500 text-xs font-extrabold flex items-center justify-center shrink-0">
                            {i + 1}
                          </span>
                          <span className="font-bold text-sm text-foreground capitalize">{curso.tipo}</span>
                        </div>
                        <span className="text-xs font-bold bg-blue-500/10 text-blue-600 border border-blue-500/20 px-2 py-0.5 rounded-full">
                          APP: {curso.faixaAppM} m
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-card rounded-xl p-2.5 flex flex-col gap-0.5">
                          <span className="text-muted-foreground font-semibold uppercase tracking-wide text-[10px]">Dentro do imóvel</span>
                          <span className="font-extrabold text-foreground">
                            {curso.comprimentoInternoM >= 1000
                              ? `${(curso.comprimentoInternoM / 1000).toFixed(2)} km`
                              : `${curso.comprimentoInternoM.toFixed(0)} m`}
                          </span>
                        </div>
                        <div className="bg-card rounded-xl p-2.5 flex flex-col gap-0.5">
                          <span className="text-muted-foreground font-semibold uppercase tracking-wide text-[10px]">Largura</span>
                          <span className="font-extrabold text-foreground">
                            {curso.larguraM != null ? `${curso.larguraM} m` : "Não informada"}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-start gap-2 bg-amber-500/8 border border-amber-500/20 rounded-xl p-2.5 text-xs text-amber-700 dark:text-amber-400 font-semibold">
                        <Info size={13} className="shrink-0 mt-0.5" />
                        <span>
                          Faixa de APP de <strong>{curso.faixaAppM} m</strong> obrigatória ao longo deste curso (Art. 4º Lei 12.651/2012)
                        </span>
                      </div>
                    </div>
                  ))}
                </>
              )}

              {!hidoLoading && !hidro && (
                <div className="text-center py-6 text-sm text-muted-foreground font-semibold">
                  Não foi possível carregar os dados hidrográficos.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </MobileFrame>
  );
}
