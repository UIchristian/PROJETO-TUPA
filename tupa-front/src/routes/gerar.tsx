import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
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

type GerarSearch = {
  municipio?: string;
};

export const Route = createFileRoute("/gerar")({
  validateSearch: (search: Record<string, unknown>): GerarSearch => ({
    municipio: (search.municipio as string) || "Abadia Dos Dourados",
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
  const { municipio } = Route.useSearch();
  const [currentStage, setCurrentStage] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isFinished, setIsFinished] = useState(false);

  useEffect(() => {
    if (isFinished) return;

    // Simulate pipeline taking around 5-7.5 seconds total (1-1.5s per stage)
    const totalDurationMs = 6000;
    const intervalMs = 100;
    const step = 100 / (totalDurationMs / intervalMs);

    const timer = setInterval(() => {
      setProgress((prev) => {
        const next = prev + step;
        if (next >= 100) {
          clearInterval(timer);
          setIsFinished(true);
          return 100;
        }

        const stageIndex = Math.floor((next / 100) * PIPELINE_STAGES.length);
        setCurrentStage(Math.min(stageIndex, PIPELINE_STAGES.length - 1));

        return next;
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isFinished]);

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-muted/20 items-center justify-center p-4 md:p-8 overflow-y-auto">
      <div className="max-w-2xl w-full space-y-8 bg-card p-6 md:p-10 rounded-2xl border border-border shadow-soft relative overflow-hidden">
        <div className="text-center space-y-2 relative z-10">
          <h1 className="text-3xl font-extrabold text-foreground tracking-tight">
            {isFinished ? "Base gerada" : "Gerando base de referência"}
          </h1>
          <p className="text-muted-foreground text-lg">{municipio}</p>
        </div>

        <div className="space-y-6 relative z-10 py-4">
          {PIPELINE_STAGES.map((stage, index) => {
            const Icon = stage.icon;
            let statusColor = "text-muted-foreground opacity-50";
            let statusText = "Aguardando";

            if (index < currentStage || isFinished) {
              statusColor = "text-green-600 dark:text-green-500";
              statusText = "Concluída";
            } else if (index === currentStage) {
              statusColor = "text-primary font-medium";
              statusText = "Processando...";
            }

            return (
              <div key={stage.id} className="flex items-center gap-4">
                <div
                  className={`p-3 rounded-xl transition-colors duration-500 ${index === currentStage ? "bg-primary/20 text-primary ring-4 ring-primary/10" : ""} ${index < currentStage || isFinished ? "bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400" : "bg-muted text-muted-foreground"}`}
                >
                  <Icon className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <div
                    className={`text-lg transition-all duration-300 ${index === currentStage ? "font-bold text-foreground" : "text-foreground/70"}`}
                  >
                    {stage.label}
                  </div>
                  <div className={`text-sm transition-all duration-300 ${statusColor}`}>
                    {statusText}
                  </div>
                </div>
                <div>
                  {index < currentStage || isFinished ? (
                    <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-500 transition-all duration-500 scale-100" />
                  ) : index === currentStage ? (
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

        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 text-amber-800 dark:text-amber-400 p-4 rounded-xl text-center text-sm font-semibold relative z-10 mt-4 flex items-center justify-center gap-2">
          A base será um rascunho para validação.
        </div>

        {isFinished && (
          <div className="pt-4 flex justify-center animate-in fade-in slide-in-from-bottom-4 duration-500 relative z-10">
            <Button
              asChild
              size="lg"
              className="w-full text-lg h-14 bg-primary text-primary-foreground hover:bg-primary/90 shadow-md hover:shadow-lg transition-all"
            >
              <Link to="/mapa" search={{ municipio }}>
                Ver base de referência gerada <ArrowRight className="w-5 h-5 ml-2" />
              </Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
