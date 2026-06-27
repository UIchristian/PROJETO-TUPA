import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Satellite,
  Layers,
  Waves,
  Mountain,
  Scale,
  CheckCircle2,
  Loader2,
  ArrowRight,
} from "lucide-react";

const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

type GerarSearch = {
  car?: string;
  municipio?: string;
};

export const Route = createFileRoute("/gerar")({
  validateSearch: (search: Record<string, unknown>): GerarSearch => ({
    car: (search.car as string) || undefined,
    municipio: (search.municipio as string) || undefined,
  }),
  component: GerarScreen,
});

const PIPELINE_STAGES = [
  { id: "sentinel", label: "Sentinel-2 (imagem recente)", icon: Satellite },
  { id: "mapbiomas", label: "MapBiomas (cobertura)", icon: Layers },
  { id: "hidrografia", label: "Hidrografia (ANA / IBGE)", icon: Waves },
  { id: "declividade", label: "Declividade (DEM)", icon: Mountain },
  { id: "codigo", label: "Regras do Código Florestal", icon: Scale },
];

function GerarScreen() {
  const { car, municipio } = Route.useSearch();
  const navigate = useNavigate();

  const label = municipio || car || "—";

  const [currentStage, setCurrentStage] = useState(0);
  const [progress, setProgress] = useState(0);
  const [animDone, setAnimDone] = useState(false);
  const [apiDone, setApiDone] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const apiCalled = useRef(false);

  // 6-second animation through stages
  useEffect(() => {
    if (animDone) return;
    const totalMs = 6000;
    const intervalMs = 100;
    const step = 100 / (totalMs / intervalMs);
    const timer = setInterval(() => {
      setProgress((prev) => {
        const next = prev + step;
        if (next >= 100) {
          clearInterval(timer);
          setAnimDone(true);
          return 100;
        }
        const stageIndex = Math.floor((next / 100) * PIPELINE_STAGES.length);
        setCurrentStage(Math.min(stageIndex, PIPELINE_STAGES.length - 1));
        return next;
      });
    }, intervalMs);
    return () => clearInterval(timer);
  }, [animDone]);

  // Real backend call (if car param is present)
  useEffect(() => {
    if (!car || apiCalled.current) return;
    apiCalled.current = true;
    fetch(`${BASE}/imovel/processar/${encodeURIComponent(car)}`, { method: "POST" })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setApiDone(true);
      })
      .catch((err) => {
        console.error("processar_car error:", err);
        setApiError(String(err));
        setApiDone(true); // still let user proceed
      });
  }, [car]);

  // If there is no car param, mark apiDone immediately (legacy municipio-only flow)
  useEffect(() => {
    if (!car) setApiDone(true);
  }, [car]);

  const isFinished = animDone && apiDone;
  const waitingForApi = animDone && !apiDone;

  function handleVerResultado() {
    if (!isFinished) return;
    navigate({ to: "/mapa", search: { municipio: municipio || "" } });
  }

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-muted/20 items-center justify-center p-4 md:p-8 overflow-y-auto">
      <div className="max-w-2xl w-full space-y-8 bg-card p-6 md:p-10 rounded-2xl border border-border shadow-soft relative overflow-hidden">
        <div className="text-center space-y-2 relative z-10">
          <h1 className="text-3xl font-extrabold text-foreground tracking-tight">
            {isFinished ? "Base gerada" : "Gerando base de referência"}
          </h1>
          <p className="text-muted-foreground text-lg">{label}</p>
        </div>

        <div className="space-y-6 relative z-10 py-4">
          {PIPELINE_STAGES.map((stage, index) => {
            const Icon = stage.icon;
            const done = index < currentStage || animDone;
            const active = index === currentStage && !animDone;
            const statusText = done ? "Concluída" : active ? "Processando..." : "Aguardando";
            const statusColor = done
              ? "text-green-600 dark:text-green-500"
              : active
                ? "text-primary font-medium"
                : "text-muted-foreground opacity-50";

            return (
              <div key={stage.id} className="flex items-center gap-4">
                <div
                  className={`p-3 rounded-xl transition-colors duration-500 ${
                    active
                      ? "bg-primary/20 text-primary ring-4 ring-primary/10"
                      : done
                        ? "bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  <Icon className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <div
                    className={`text-lg transition-all duration-300 ${
                      active ? "font-bold text-foreground" : "text-foreground/70"
                    }`}
                  >
                    {stage.label}
                  </div>
                  <div className={`text-sm transition-all duration-300 ${statusColor}`}>
                    {statusText}
                  </div>
                </div>
                <div>
                  {done ? (
                    <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-500 transition-all duration-500" />
                  ) : active ? (
                    <Loader2 className="w-6 h-6 text-primary animate-spin" />
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>

        <div className="space-y-2 relative z-10">
          <div className="flex justify-between text-sm font-bold text-foreground/80">
            <span>Progresso Geral</span>
            <span className="font-mono">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-3" />
        </div>

        {apiError && (
          <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-400 p-4 rounded-xl text-sm relative z-10">
            Aviso: {apiError}
          </div>
        )}

        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 text-amber-800 dark:text-amber-400 p-4 rounded-xl text-center text-sm font-semibold relative z-10 flex items-center justify-center gap-2">
          A base será um rascunho para validação.
        </div>

        {waitingForApi && (
          <div className="pt-2 flex justify-center animate-in fade-in relative z-10">
            <div className="flex items-center gap-3 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Finalizando cálculos no servidor…</span>
            </div>
          </div>
        )}

        {isFinished && (
          <div className="pt-4 flex justify-center animate-in fade-in slide-in-from-bottom-4 duration-500 relative z-10">
            <Button
              size="lg"
              className="w-full text-lg h-14 bg-primary text-primary-foreground hover:bg-primary/90 shadow-md hover:shadow-lg transition-all"
              onClick={handleVerResultado}
            >
              Ver base de referência gerada <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
