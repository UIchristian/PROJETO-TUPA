import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, lazy, Suspense, useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { getImoveis, getImovel, getBaseReferencia } from "@/api";
import {
  Search,
  MapPin,
  Loader2,
  Satellite,
  ChevronRight,
  ChevronLeft,
  Map,
  Layers,
  Waves,
  Mountain,
  Scale,
  CheckCircle2,
  AlertTriangle,
  Download,
  PanelLeftClose,
  PanelLeftOpen,
  Clock,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import type { GeoJSONGeometry, TipoFeicao, NivelConfianca, DecisaoFeicao } from "@/types/imovel";

const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

const CarPreviewMap = !import.meta.env.SSR
  ? lazy(() => import("@/components/CarPreviewMap"))
  : null;

const BaseReferenciaMap = !import.meta.env.SSR
  ? lazy(() => import("@/components/BaseReferenciaMap"))
  : null;

const PIPELINE_STAGES = [
  {
    id: "sentinel",
    label: "Sentinel-2",
    icon: Satellite,
    fonte: "Copernicus / ESA",
    desc: "Imagens de satélite ótico de alta resolução (10 m) para classificar a cobertura do solo.",
    estimativa: "~10 s",
  },
  {
    id: "mapbiomas",
    label: "MapBiomas",
    icon: Layers,
    fonte: "MapBiomas Brasil 2023",
    desc: "Mapeamento anual de uso e cobertura do solo — distingue floresta nativa, pastagem, lavoura, água etc.",
    estimativa: "~15–30 s",
  },
  {
    id: "hidrografia",
    label: "Hidrografia",
    icon: Waves,
    fonte: "BHO/ANA — Base Hidrográfica Ottocodificada",
    desc: "Rede de drenagem nacional (rios, nascentes, lagos). Usada para calcular as faixas de APP ao longo dos cursos d'água.",
    estimativa: "~30–90 s (1ª vez por município)",
  },
  {
    id: "declividade",
    label: "Declividade",
    icon: Mountain,
    fonte: "SRTM 30 m (NASA)",
    desc: "Modelo digital de elevação para calcular declividade e identificar áreas de Uso Restrito em encostas.",
    estimativa: "~10 s",
  },
  {
    id: "codigo",
    label: "Cód. Florestal",
    icon: Scale,
    fonte: "Lei 12.651/2012",
    desc: "Cruzamento espacial PostGIS: calcula APP, Reserva Legal exigida, Cobertura e gera as feições de referência.",
    estimativa: "~5–20 s",
  },
];

const TIPOS_CONFIG: { tipo: TipoFeicao; label: string; color: string }[] = [
  { tipo: "APP_CURSO_DAGUA", label: "APP curso d'água", color: "#00e1ff" },
  { tipo: "APP_NASCENTE", label: "APP nascente", color: "#00cfee" },
  { tipo: "APP_LAGO", label: "APP lago", color: "#00b8d9" },
  { tipo: "APP_VEREDA", label: "APP vereda", color: "#0099b8" },
  { tipo: "USO_RESTRITO_ENCOSTA", label: "Uso Restrito", color: "#ff8800" },
  { tipo: "RESERVA_LEGAL_PROPOSTA", label: "Reserva Legal", color: "#22c55e" },
  { tipo: "COBERTURA", label: "Cobertura do solo", color: "#4ade80" },
];

// ---------------------------------------------------------------------------
// Resizable sidebar hook
// ---------------------------------------------------------------------------

function useResizable(
  storageKey: string,
  defaultPx: number,
  min: number,
  max: number,
  side: "right" | "left",
) {
  const [width, setWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const n = parseInt(saved, 10);
        if (n >= min && n <= max) return n;
      }
    } catch {}
    return defaultPx;
  });

  const dragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragging.current = true;
      startX.current = e.clientX;
      startWidth.current = width;
      document.body.style.userSelect = "none";
      document.body.style.cursor = "col-resize";

      const onMove = (ev: MouseEvent) => {
        if (!dragging.current) return;
        const delta = side === "right" ? ev.clientX - startX.current : startX.current - ev.clientX;
        const next = Math.min(max, Math.max(min, startWidth.current + delta));
        setWidth(next);
      };

      const onUp = () => {
        dragging.current = false;
        document.body.style.userSelect = "";
        document.body.style.cursor = "";
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        setWidth((w) => {
          try { localStorage.setItem(storageKey, String(w)); } catch {}
          return w;
        });
      };

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [width, side, min, max, storageKey],
  );

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      const touch = e.touches[0];
      dragging.current = true;
      startX.current = touch.clientX;
      startWidth.current = width;
      document.body.style.userSelect = "none";

      const onMove = (ev: TouchEvent) => {
        if (!dragging.current) return;
        const t = ev.touches[0];
        const delta = side === "right" ? t.clientX - startX.current : startX.current - t.clientX;
        const next = Math.min(max, Math.max(min, startWidth.current + delta));
        setWidth(next);
      };

      const onEnd = () => {
        dragging.current = false;
        document.body.style.userSelect = "";
        document.removeEventListener("touchmove", onMove);
        document.removeEventListener("touchend", onEnd);
        setWidth((w) => {
          try { localStorage.setItem(storageKey, String(w)); } catch {}
          return w;
        });
      };

      document.addEventListener("touchmove", onMove, { passive: true });
      document.addEventListener("touchend", onEnd);
    },
    [width, side, min, max, storageKey],
  );

  return { width, onMouseDown, onTouchStart };
}

// ---------------------------------------------------------------------------
// Resize handle component
// ---------------------------------------------------------------------------

function ResizeHandle({
  onMouseDown,
  onTouchStart,
  side,
}: {
  onMouseDown: (e: React.MouseEvent) => void;
  onTouchStart: (e: React.TouchEvent) => void;
  side: "right" | "left";
}) {
  return (
    <div
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
      style={{ [side === "right" ? "right" : "left"]: 0 }}
      className="
        absolute top-0 bottom-0 w-[6px] z-50
        cursor-col-resize
        group
        select-none
      "
    >
      {/* visible line on hover / drag */}
      <div
        className="
          absolute top-0 bottom-0
          w-[2px]
          bg-primary/0
          group-hover:bg-primary/40
          transition-colors duration-150
        "
        style={{ [side === "right" ? "right" : "left"]: 2 }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------

export const Route = createFileRoute("/")({
  component: PainelCobertura,
});

type ProcessingState = "idle" | "processing" | "done";

const MapLoader = () => (
  <div className="w-full h-full flex items-center justify-center">
    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
  </div>
);

function PainelCobertura() {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [processingState, setProcessingState] = useState<ProcessingState>("idle");
  const [progress, setProgress] = useState(0);
  const [currentStage, setCurrentStage] = useState(0);
  const [apiError, setApiError] = useState<string | null>(null);
  const [tiposVisiveis, setTiposVisiveis] = useState<Set<TipoFeicao>>(
    new Set(TIPOS_CONFIG.map((t) => t.tipo)),
  );
  const confiancasVisiveis = useMemo<Set<NivelConfianca>>(
    () => new Set(["alta", "media", "baixa"]),
    [],
  );
  const [elapsedSecs, setElapsedSecs] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const animTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [leftOpen, setLeftOpen] = useState(true);
  const leftSidebar = useResizable("sidebarLeftWidth", 380, 240, 480, "right");
  const rightSidebar = useResizable("sidebarRightWidth", 300, 240, 480, "left");

  const { data: imoveis = [], isLoading } = useQuery({
    queryKey: ["imoveis"],
    queryFn: getImoveis,
  });

  const filtered = useMemo(() => {
    if (!search) return imoveis;
    const q = search.toLowerCase();
    return imoveis.filter(
      (i) => i.municipio.toLowerCase().includes(q) || i.numeroCAR.toLowerCase().includes(q),
    );
  }, [imoveis, search]);

  const selected = imoveis.find((i) => i.id === selectedId);

  const hasCoords = (g: GeoJSONGeometry | null | undefined) =>
    !!g && Array.isArray(g.coordinates) && g.coordinates.length > 0;

  const needsDetail = !!selectedId && !hasCoords(selected?.poligonoDeclarado);
  const { data: selectedDetail, isLoading: loadingDetail } = useQuery({
    queryKey: ["imovel-detail", selectedId],
    queryFn: () => getImovel(selectedId!),
    enabled: needsDetail,
  });

  const geometry: GeoJSONGeometry | null = hasCoords(selected?.poligonoDeclarado)
    ? selected!.poligonoDeclarado
    : hasCoords(selectedDetail?.poligonoDeclarado)
      ? selectedDetail!.poligonoDeclarado
      : null;

  const municipiosCount = useMemo(
    () => new Set(imoveis.map((i) => i.municipio)).size,
    [imoveis],
  );

  const { data: baseRef, isLoading: loadingBase } = useQuery({
    queryKey: ["baseReferencia", selected?.municipio],
    queryFn: () => getBaseReferencia(selected!.municipio),
    enabled: processingState === "done" && !!selected?.municipio,
  });

  const resumo = useMemo(() => {
    if (!baseRef?.feicoes) return null;
    let total = 0, haApp = 0, haRL = 0, haUR = 0, alta = 0, media = 0, baixa = 0;
    baseRef.feicoes.forEach((f) => {
      total++;
      if (f.tipo.startsWith("APP_")) haApp += f.areaHectares;
      else if (f.tipo === "RESERVA_LEGAL_PROPOSTA") haRL += f.areaHectares;
      else if (f.tipo === "USO_RESTRITO_ENCOSTA") haUR += f.areaHectares;
      if (f.confianca === "alta") alta++;
      else if (f.confianca === "media") media++;
      else baixa++;
    });
    return {
      total, haApp, haRL, haUR,
      percAlta: total > 0 ? (alta / total) * 100 : 0,
      percMedia: total > 0 ? (media / total) * 100 : 0,
      percBaixa: total > 0 ? (baixa / total) * 100 : 0,
    };
  }, [baseRef]);

  // Which tipos actually have features in this result
  const tiposComDados = useMemo(() => {
    if (!baseRef?.feicoes) return new Set<TipoFeicao>();
    return new Set(baseRef.feicoes.map((f) => f.tipo));
  }, [baseRef]);

  function toggleTipo(tipo: TipoFeicao) {
    setTiposVisiveis((prev) => {
      const next = new Set(prev);
      if (next.has(tipo)) next.delete(tipo);
      else next.add(tipo);
      return next;
    });
  }

  function baixarGeoJSON() {
    if (!baseRef?.feicoes) return;
    let decisoes: Record<string, { decisao: DecisaoFeicao }> = {};
    try {
      const saved = localStorage.getItem("tupa_decisoes_feicao");
      if (saved) decisoes = JSON.parse(saved);
    } catch {}
    const fc = {
      type: "FeatureCollection",
      features: baseRef.feicoes.map((f) => ({
        type: "Feature",
        geometry: f.geometry,
        properties: {
          id: f.id,
          tipo: f.tipo,
          base_legal: f.baseLegal,
          area_hectares: f.areaHectares,
          confianca: f.confianca,
          decisao: decisoes[f.id]?.decisao || f.decisao || "pendente",
        },
      })),
    };
    const blob = new Blob([JSON.stringify(fc)], { type: "application/geo+json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `base-referencia-${selected?.municipio?.toLowerCase().replace(/\s+/g, "-")}.geojson`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function startAnimation() {
    setProgress(0);
    setCurrentStage(0);
    setElapsedSecs(0);
    if (animTimerRef.current) clearInterval(animTimerRef.current);
    if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);

    // Elapsed counter — 1 tick/s
    elapsedTimerRef.current = setInterval(() => {
      setElapsedSecs((s) => s + 1);
    }, 1000);

    // Phase 1: 0 → 90% in 8 s  |  Phase 2: crawl 90 → 99% at 0.02%/tick
    const PHASE1_TARGET = 90;
    const phase1Step = PHASE1_TARGET / (8000 / 80);
    animTimerRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 99) return 99;
        const step = prev < PHASE1_TARGET ? phase1Step : 0.02;
        const next = Math.min(99, prev + step);
        setCurrentStage(
          Math.min(
            Math.floor((next / 100) * PIPELINE_STAGES.length),
            PIPELINE_STAGES.length - 1,
          ),
        );
        return next;
      });
    }, 80);
  }

  function stopAnimation(success: boolean) {
    if (animTimerRef.current) { clearInterval(animTimerRef.current); animTimerRef.current = null; }
    if (elapsedTimerRef.current) { clearInterval(elapsedTimerRef.current); elapsedTimerRef.current = null; }
    if (success) {
      setProgress(100);
      setCurrentStage(PIPELINE_STAGES.length);
    }
  }

  function fmtElapsed(s: number) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}:${String(sec).padStart(2, "0")} min` : `${sec} s`;
  }

  useEffect(() => {
    if (!selectedId || !selected) return;
    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setProcessingState("processing");
    setApiError(null);
    startAnimation();
    fetch(`${BASE}/imovel/processar/${encodeURIComponent(selected.numeroCAR)}`, {
      method: "POST",
      signal: ctrl.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        stopAnimation(true);
        setProcessingState("done");
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        stopAnimation(false);
        setApiError(String(err));
        setProcessingState("done");
      });
    return () => {
      ctrl.abort();
      if (animTimerRef.current) clearInterval(animTimerRef.current);
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    };
  }, [selectedId]);

  function handleSelect(id: string) {
    if (id === selectedId) return;
    setProcessingState("idle");
    setProgress(0);
    setCurrentStage(0);
    setElapsedSecs(0);
    setApiError(null);
    setSelectedId(id);
  }

  const showSidebar = processingState === "done";

  return (
    <div className="relative flex flex-1 min-h-0 overflow-hidden">
      {/* Left: CAR list — collapsible */}
      {leftOpen && (
        <div
          className="flex-shrink-0 flex flex-col border-r border-border bg-card overflow-hidden relative"
          style={{ width: leftSidebar.width }}
        >
          <ResizeHandle
            side="right"
            onMouseDown={leftSidebar.onMouseDown}
            onTouchStart={leftSidebar.onTouchStart}
          />
          <div className="p-3 border-b border-border flex items-center justify-between gap-2">
            <div className="min-w-0">
              <h1 className="text-base font-bold text-foreground">Painel de Cobertura</h1>
            </div>
            <button
              onClick={() => setLeftOpen(false)}
              title="Ocultar painel"
              className="shrink-0 mt-0.5 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          </div>

        <div className="grid grid-cols-2 gap-2 p-3 border-b border-border">
          <div className="bg-muted/50 rounded-lg p-2">
            <div className="text-lg font-bold tabular-nums">
              {isLoading ? "—" : imoveis.length}
            </div>
            <div className="text-xs text-muted-foreground">CARs disponíveis</div>
          </div>
          <div className="bg-muted/50 rounded-lg p-2">
            <div className="text-lg font-bold tabular-nums">
              {isLoading ? "—" : municipiosCount}
            </div>
            <div className="text-xs text-muted-foreground">Municípios de MG</div>
          </div>
        </div>

        <div className="p-3 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar município ou número CAR..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-border">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Nenhum CAR encontrado
            </div>
          ) : (
            filtered.map((imovel) => {
              const isSelected = selectedId === imovel.id;
              return (
                <button
                  key={imovel.id}
                  onClick={() => handleSelect(imovel.id)}
                  className={`w-full text-left px-3 py-2 hover:bg-muted/40 transition-colors flex items-center gap-3 border-l-2 ${
                    isSelected ? "bg-primary/10 border-primary" : "border-transparent"
                  }`}
                >
                  <MapPin
                    className={`w-4 h-4 shrink-0 ${isSelected ? "text-primary" : "text-muted-foreground"}`}
                  />
                  <div className="flex-1 min-w-0">
                    <div
                      className={`text-sm font-semibold ${isSelected ? "text-primary" : "text-foreground"}`}
                    >
                      {imovel.municipio} — MG
                    </div>
                    <div className="text-xs text-muted-foreground font-mono truncate">
                      {imovel.numeroCAR}
                    </div>
                  </div>
                  <ChevronRight
                    className={`w-3.5 h-3.5 shrink-0 ${isSelected ? "text-primary" : "text-muted-foreground/50"}`}
                  />
                </button>
              );
            })
          )}
        </div>
        </div>
      )}

      {/* Floating button to reopen left panel when collapsed */}
      {!leftOpen && (
        <button
          onClick={() => setLeftOpen(true)}
          title="Mostrar painel"
          className="absolute left-3 top-20 z-[1001] flex items-center gap-1.5 bg-card border border-border shadow-md text-xs font-semibold text-foreground px-3 py-2 rounded-lg hover:bg-muted transition-colors"
        >
          <PanelLeftOpen className="w-4 h-4" />
          Painel
        </button>
      )}

      {/* Center: Map */}
      <div className="flex-1 flex flex-col overflow-hidden bg-muted/20 min-w-0">
        {selectedId ? (
          <>
            <div className="flex-1 relative overflow-hidden">
              {processingState === "done" ? (
                loadingBase ? (
                  <MapLoader />
                ) : baseRef && BaseReferenciaMap ? (
                  <Suspense fallback={<MapLoader />}>
                    <BaseReferenciaMap
                      limites={baseRef.limites.map((l) => ({ id: l.id, geometry: l.geometry }))}
                      feicoes={baseRef.feicoes}
                      tiposVisiveis={tiposVisiveis}
                      confiancasVisiveis={confiancasVisiveis}
                    />
                  </Suspense>
                ) : (
                  <MapLoader />
                )
              ) : (
                <>
                  {needsDetail && loadingDetail ? (
                    <MapLoader />
                  ) : geometry && CarPreviewMap ? (
                    <Suspense fallback={<MapLoader />}>
                      <CarPreviewMap geometry={geometry} />
                    </Suspense>
                  ) : !geometry ? (
                    <MapLoader />
                  ) : null}
                </>
              )}

              {selected && (
                <div className="absolute bottom-3 left-3 bg-black/60 text-white text-xs px-3 py-1.5 rounded-full backdrop-blur-sm max-w-[90%] truncate z-[1000]">
                  {selected.municipio} — {selected.numeroCAR}
                </div>
              )}
            </div>

            {/* Bottom pipeline bar — only during processing */}
            {processingState === "processing" && (
              <div className="shrink-0 border-t border-border bg-card px-3 pt-2 pb-2 space-y-2">
                {/* Row 1: title + elapsed + estimate */}
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-foreground flex items-center gap-2 min-w-0">
                    <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />
                    <span className="truncate">
                      {progress >= 90 ? "Aguardando servidor…" : "Gerando base de referência…"}
                    </span>
                  </span>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      {fmtElapsed(elapsedSecs)}
                    </span>
                    <span className="text-xs text-muted-foreground/60 hidden sm:inline">
                      est. 30 s – 3 min
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <Progress value={progress} className="h-1.5" />

                {/* Pipeline stages */}
                <div className="flex gap-1.5">
                  {PIPELINE_STAGES.map((stage, i) => {
                    const done = i < currentStage;
                    const active = i === currentStage;
                    const Icon = stage.icon;
                    return (
                      <div key={stage.id} className="flex flex-col items-center gap-1 flex-1 min-w-0">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors duration-300 ${
                            done
                              ? "bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400"
                              : active
                                ? "bg-primary/20 text-primary ring-2 ring-primary/20"
                                : "bg-muted text-muted-foreground/30"
                          }`}
                        >
                          {done ? (
                            <CheckCircle2 className="w-4 h-4" />
                          ) : (
                            <Icon className={`w-4 h-4 ${active ? "animate-pulse" : ""}`} />
                          )}
                        </div>
                        <span className="text-[9px] text-center text-muted-foreground leading-tight truncate w-full px-0.5">
                          {stage.label}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Active stage description */}
                {currentStage < PIPELINE_STAGES.length && (
                  <div className="flex items-start gap-2 bg-muted/40 rounded-lg px-3 py-2">
                    <Info className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold text-foreground leading-tight">
                        {PIPELINE_STAGES[currentStage].label}
                        <span className="ml-1.5 font-normal text-muted-foreground">
                          — {PIPELINE_STAGES[currentStage].fonte}
                        </span>
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
                        {PIPELINE_STAGES[currentStage].desc}
                      </p>
                      <p className="text-[10px] text-primary/70 mt-0.5 font-medium">
                        Tempo típico: {PIPELINE_STAGES[currentStage].estimativa}
                      </p>
                    </div>
                  </div>
                )}

                {/* Waiting hint when server is slow */}
                {progress >= 90 && (
                  <p className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                    <Clock className="w-3 h-3 shrink-0" />
                    Na 1ª extração por município, a Hidrografia (BHO/ANA) pode levar 1–3 min.
                    Nas próximas o sistema usa o cache — muito mais rápido.
                  </p>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-muted-foreground">
            <div className="w-20 h-20 rounded-2xl bg-card border border-border flex items-center justify-center shadow-sm">
              <Map className="w-10 h-10 text-muted-foreground/60" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-foreground">Prévia Espacial</p>
              <p className="text-sm mt-1">
                Selecione um CAR na lista para iniciar a geração automática
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Right sidebar — visible when processing is done */}
      {showSidebar && (
        <div
          className="flex-shrink-0 flex flex-col border-l border-border bg-card overflow-hidden relative"
          style={{ width: rightSidebar.width }}
        >
          <ResizeHandle
            side="left"
            onMouseDown={rightSidebar.onMouseDown}
            onTouchStart={rightSidebar.onTouchStart}
          />
          {/* Header */}
          <div className="p-3 border-b border-border">
            <div className="flex items-center gap-2">
              {apiError ? (
                <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span className="text-sm font-bold">Processado com avisos</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span className="text-sm font-bold">Base gerada</span>
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1 truncate">
              {selected?.municipio} — MG
            </p>
          </div>

          <div className="flex-1 overflow-y-auto">
            {/* Volume stats */}
            <div className="p-3 border-b border-border">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Volume da Base
              </p>
              {loadingBase || !resumo ? (
                <div className="grid grid-cols-2 gap-2">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="bg-muted/50 rounded-lg p-2 animate-pulse h-12" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-muted/40 rounded-lg p-2">
                    <div className="text-xs text-muted-foreground">Total feições</div>
                    <div className="text-lg font-bold tabular-nums">{resumo.total}</div>
                  </div>
                  <div className="bg-muted/40 rounded-lg p-2">
                    <div className="text-xs text-muted-foreground">APP (ha)</div>
                    <div className="text-lg font-bold tabular-nums font-mono">
                      {resumo.haApp.toFixed(1)}
                    </div>
                  </div>
                  <div className="bg-muted/40 rounded-lg p-2">
                    <div className="text-xs text-muted-foreground">Reserva Legal (ha)</div>
                    <div className="text-lg font-bold tabular-nums font-mono">
                      {resumo.haRL.toFixed(1)}
                    </div>
                  </div>
                  <div className="bg-muted/40 rounded-lg p-2">
                    <div className="text-xs text-muted-foreground">Uso Restrito (ha)</div>
                    <div className="text-lg font-bold tabular-nums font-mono">
                      {resumo.haUR.toFixed(1)}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Confiança */}
            <div className="p-3 border-b border-border">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Confiança do Motor
              </p>
              {loadingBase || !resumo ? (
                <div className="space-y-3 animate-pulse">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-8 bg-muted/50 rounded" />
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="flex items-center gap-1.5 text-[var(--conf-alta)]">
                        <span className="w-2 h-2 rounded-full bg-[var(--conf-alta)] inline-block" />
                        Alta
                      </span>
                      <span className="font-mono font-bold">{resumo.percAlta.toFixed(0)}%</span>
                    </div>
                    <Progress
                      value={resumo.percAlta}
                      className="h-1.5 [&>div]:bg-[var(--conf-alta)]"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="flex items-center gap-1.5 text-[var(--conf-media)]">
                        <span className="w-2 h-2 rounded-full bg-[var(--conf-media)] inline-block" />
                        Média
                      </span>
                      <span className="font-mono font-bold">{resumo.percMedia.toFixed(0)}%</span>
                    </div>
                    <Progress
                      value={resumo.percMedia}
                      className="h-1.5 [&>div]:bg-[var(--conf-media)]"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="flex items-center gap-1.5 text-[var(--conf-baixa)]">
                        <span className="w-2 h-2 rounded-full bg-[var(--conf-baixa)] inline-block" />
                        Baixa
                      </span>
                      <span className="font-mono font-bold">{resumo.percBaixa.toFixed(0)}%</span>
                    </div>
                    <Progress
                      value={resumo.percBaixa}
                      className="h-1.5 [&>div]:bg-[var(--conf-baixa)]"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Camadas */}
            <div className="p-3 border-b border-border">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Camadas da Base
              </p>
              <div className="space-y-2">
                {TIPOS_CONFIG.filter((tc) => tiposComDados.has(tc.tipo)).map((tc) => {
                  const count = baseRef?.feicoes.filter((f) => f.tipo === tc.tipo).length ?? 0;
                  const active = tiposVisiveis.has(tc.tipo);
                  return (
                    <button
                      key={tc.tipo}
                      onClick={() => toggleTipo(tc.tipo)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors ${
                        active ? "bg-muted/60" : "bg-transparent opacity-40"
                      }`}
                    >
                      <span
                        className="w-3 h-3 rounded-sm shrink-0"
                        style={{ backgroundColor: tc.color }}
                      />
                      <span className="text-xs flex-1 font-medium">{tc.label}</span>
                      <span className="text-[10px] text-muted-foreground font-mono tabular-nums">
                        ({count})
                      </span>
                      <div
                        className={`w-8 h-4 rounded-full transition-colors ${active ? "bg-primary" : "bg-muted"}`}
                      >
                        <div
                          className={`w-3 h-3 rounded-full bg-white shadow mt-0.5 transition-transform ${active ? "translate-x-4" : "translate-x-0.5"}`}
                        />
                      </div>
                    </button>
                  );
                })}
                {!loadingBase && tiposComDados.size === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    Nenhuma feição gerada ainda
                  </p>
                )}
                {loadingBase && (
                  <div className="space-y-2 animate-pulse">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="h-9 bg-muted/50 rounded-lg" />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Export */}
            <div className="p-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Exportar
              </p>
              <Button
                className="w-full gap-2"
                disabled={!baseRef?.feicoes?.length}
                onClick={baixarGeoJSON}
              >
                <Download className="w-4 h-4" />
                Baixar GeoJSON
              </Button>
              <p className="text-[10px] text-muted-foreground text-center mt-2">
                Arquivo completo com todas as feições
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
