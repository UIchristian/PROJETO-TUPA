import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Info,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  Wrench,
  ChevronRight,
} from "lucide-react";
import { MobileFrame } from "@/components/MobileFrame";
import { useAppState, appStore } from "@/lib/app-store";
import { t, useTranslation } from "@/lib/i18n";
import {
  getImoveis,
  getDiagnostico,
  getLayers,
  Imovel,
  Diagnostico,
  LayerGeometries,
  MOCK_IMOVEIS,
} from "@/mock";

const TupaMap = lazy(() => import("@/components/TupaMap"));

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

  // Selected property (imóvel) state
  const [imoveis, setImoveis] = useState<Imovel[]>([]);
  const [selectedImovelId, setSelectedImovelId] = useState<string>("");
  const [diagnostico, setDiagnostico] = useState<Diagnostico | null>(null);
  const [layers, setLayers] = useState<LayerGeometries | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Map layer controls
  const [showDeclared, setShowDeclared] = useState(true);
  const [showApp, setShowApp] = useState(true);
  const [showRestrito, setShowRestrito] = useState(true);
  const [showUsoCobertura, setShowUsoCobertura] = useState(true);
  const [showDivergencias, setShowDivergencias] = useState(true);

  // Dynamically set client-side page title
  useEffect(() => {
    document.title = t("diagnostico.headTitle");
  }, [t, language]);

  // Load properties and listen to global active property changes
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError(false);
        const list = await getImoveis();
        setImoveis(list);

        const targetId = activeTerrenoId || (list.length > 0 ? list[0].id : "");
        if (targetId) {
          setSelectedImovelId(targetId);

          let diag = await getDiagnostico(targetId);
          if (!diag) {
            // Fallback diagnostics for newly registered custom lands
            diag = {
              imovelId: targetId,
              scoreConformidade: 75,
              coberturaSolo: [
                { classe: "Floresta Nativa (Cerrado)", percentual: 35, corHex: "#15803D" },
                { classe: "Lavoura Temporária", percentual: 45, corHex: "#EAB308" },
                { classe: "Pastagem", percentual: 15, corHex: "#86EFAC" },
                { classe: "Corpos d'Água", percentual: 5, corHex: "#3B82F6" },
              ],
              divergencias: [
                {
                  id: "custom-div-1",
                  tipo: "Cultivo Agrícola em APP Degradada",
                  areaHectares: 1.8,
                  severidade: "alta",
                  textoLinguagemSimples:
                    "Foi identificado cultivo agrícola comercial ativo na faixa de preservação permanente (APP).",
                  caminhoRetificacao:
                    "Cessar o cultivo comercial na APP e permitir a regeneração natural.",
                  poligonoDivergencia: { type: "Polygon", coordinates: [] },
                },
              ],
            };
          }
          setDiagnostico(diag);

          let lay = await getLayers(targetId);
          if (!lay) {
            // Fallback layout using default Sol Nascente layers
            const defaultMockImovel = list[0] || MOCK_IMOVEIS[0];
            lay = await getLayers(defaultMockImovel.id);
          }
          setLayers(lay);

          if (!activeTerrenoId) {
            appStore.set({ activeTerrenoId: targetId });
          }
        }
      } catch (err) {
        console.error(err);
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [activeTerrenoId]);

  // Handle switching properties
  const handleImovelChange = (id: string) => {
    appStore.set({ activeTerrenoId: id });
  };

  // Resolve selected imovel, fall back to custom terrain in store if not in MOCK list
  let selectedImovel = imoveis.find((im) => im.id === selectedImovelId);
  if (!selectedImovel && selectedImovelId) {
    const activeTerreno = farmer.terrenos?.find((t) => t.id === selectedImovelId);
    if (activeTerreno) {
      selectedImovel = {
        id: activeTerreno.id,
        nome: activeTerreno.name,
        municipio: activeTerreno.address.split(",")[0] || "Unaí",
        uf: activeTerreno.address.split(",")[1]?.trim() || "MG",
        areaHectares: activeTerreno.hectares || 12,
        numeroCAR: activeTerreno.carNumber || "BR-MG-3170107-000000-00",
        poligonoDeclarado: {
          type: "Polygon",
          coordinates: [activeTerreno.points.map((p) => [p.lng, p.lat])],
        },
      };
    } else {
      selectedImovel = imoveis[0];
    }
  }

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
              onClick={() => handleImovelChange(selectedImovelId)}
              className="mt-2 px-5 py-2.5 bg-primary text-primary-foreground font-bold text-sm rounded-xl hover:opacity-90 active:scale-95 transition-all cursor-pointer"
            >
              {t("cadastro.tentar_novamente")}
            </button>
          </div>
        )}

        {/* Main Content Area */}
        {!loading && !error && selectedImovel && (
          <div className="flex-1 p-5 flex flex-col gap-5 pb-24 overflow-y-auto no-scrollbar">
            {/* Imovel Selector Card */}
            <div className="rounded-2xl border border-border bg-card p-4 shadow-card flex flex-col gap-3">
              <div className="flex flex-col gap-1 text-left">
                <span className="text-xs uppercase font-bold tracking-wider text-muted-foreground">
                  {t("profile.propertySection")}
                </span>

                {imoveis.length > 1 ? (
                  <div className="relative w-full mt-1">
                    <select
                      value={selectedImovelId}
                      onChange={(e) => handleImovelChange(e.target.value)}
                      className="bg-soft hover:bg-secondary border border-border rounded-xl pl-3 pr-9 py-2 text-base font-bold text-foreground outline-none cursor-pointer appearance-none w-full transition-all truncate"
                    >
                      {imoveis.map((imovel) => (
                        <option key={imovel.id} value={imovel.id}>
                          {imovel.nome}
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
            <div className="relative w-full h-[280px] rounded-2xl overflow-hidden shadow-soft shrink-0 border border-border">
              <Suspense
                fallback={
                  <div className="w-full h-full flex items-center justify-center bg-soft text-sm text-muted-foreground font-bold">
                    <Loader2 className="w-6 h-6 animate-spin text-primary mr-2" />
                    {t("diagnostico.loading")}
                  </div>
                }
              >
                {!import.meta.env.SSR && layers && (
                  <TupaMap
                    imovel={selectedImovel}
                    layers={layers}
                    showDeclared={showDeclared}
                    showApp={showApp}
                    showRestrito={showRestrito}
                    showUsoCobertura={showUsoCobertura}
                    showDivergencias={showDivergencias}
                  />
                )}
              </Suspense>

              {/* Floating Custom Layers Control Toggles Panel (Glassmorphic) */}
              <div className="absolute top-2 right-2 z-[1000] bg-card/90 dark:bg-card/95 backdrop-blur-md border border-border rounded-xl p-2.5 shadow-card text-left w-48 text-[11px] leading-tight animate-in fade-in duration-200">
                <h3 className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1 border-b border-border/40 pb-1">
                  <Info size={12} className="text-primary shrink-0" />
                  {t("diagnostico.layerControlTitle")}
                </h3>
                <div className="flex flex-col gap-1.5">
                  <label className="flex items-center gap-1.5 font-bold cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={showDeclared}
                      onChange={() => setShowDeclared(!showDeclared)}
                      className="rounded text-primary accent-primary w-3.5 h-3.5 cursor-pointer shrink-0"
                    />
                    <span className="w-3 h-1 bg-primary rounded-sm inline-block shrink-0" />
                    <span className="truncate">{t("diagnostico.layerDeclared")}</span>
                  </label>
                  <label className="flex items-center gap-1.5 font-bold cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={showApp}
                      onChange={() => setShowApp(!showApp)}
                      className="rounded text-primary accent-primary w-3.5 h-3.5 cursor-pointer shrink-0"
                    />
                    <span className="w-3 h-1 border border-dashed border-[#3b82f6] bg-[#3b82f6]/20 rounded-sm inline-block shrink-0" />
                    <span className="truncate">{t("diagnostico.layerApp")}</span>
                  </label>
                  {layers?.usoRestrito && (
                    <label className="flex items-center gap-1.5 font-bold cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={showRestrito}
                        onChange={() => setShowRestrito(!showRestrito)}
                        className="rounded text-primary accent-primary w-3.5 h-3.5 cursor-pointer shrink-0"
                      />
                      <span className="w-3 h-1 border border-dashed border-[#c68a35] bg-[#c68a35]/20 rounded-sm inline-block shrink-0" />
                      <span className="truncate">{t("diagnostico.layerUsoRestrito")}</span>
                    </label>
                  )}
                  <label className="flex items-center gap-1.5 font-bold cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={showUsoCobertura}
                      onChange={() => setShowUsoCobertura(!showUsoCobertura)}
                      className="rounded text-primary accent-primary w-3.5 h-3.5 cursor-pointer shrink-0"
                    />
                    <span className="w-3 h-1 bg-[#EAB308]/60 rounded-sm inline-block shrink-0" />
                    <span className="truncate">{t("diagnostico.layerUsoCobertura")}</span>
                  </label>
                  <label className="flex items-center gap-1.5 font-bold cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={showDivergencias}
                      onChange={() => setShowDivergencias(!showDivergencias)}
                      className="rounded text-primary accent-primary w-3.5 h-3.5 cursor-pointer shrink-0"
                    />
                    <span className="w-3 h-1 bg-[#ef4444] rounded-sm inline-block shrink-0" />
                    <span className="truncate">{t("diagnostico.layerDivergencia")}</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Land Cover Classification breakdown */}
            <div className="rounded-2xl border border-border bg-card p-4 shadow-card flex flex-col gap-3 text-left">
              <h3 className="font-bold text-base text-foreground flex items-center gap-1.5">
                🗺️ {t("diagnostico.coverageTitle")}
              </h3>

              <div className="flex flex-col gap-3 mt-1.5">
                {diagnostico?.coberturaSolo.map((item, idx) => (
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
                    {/* Linear class percentage progress bar */}
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
    </MobileFrame>
  );
}
