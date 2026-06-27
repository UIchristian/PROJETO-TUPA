import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getDiagnostico, getImovel } from "@/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  FileEdit,
  ChevronRight,
} from "lucide-react";
import type { GeoJSONGeometry } from "@/types/imovel";
import { lazy, Suspense } from "react";

const CarPreviewMap = !import.meta.env.SSR
  ? lazy(() => import("@/components/CarPreviewMap"))
  : null;

type DiagnosticoSearch = { imovelId?: string; municipio?: string };

export const Route = createFileRoute("/diagnostico")({
  validateSearch: (search: Record<string, unknown>): DiagnosticoSearch => ({
    imovelId: (search.imovelId as string) || undefined,
    municipio: (search.municipio as string) || undefined,
  }),
  component: DiagnosticoScreen,
});

const SEV_LABEL: Record<string, string> = {
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
};

const SEV_CLASS: Record<string, string> = {
  alta: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
  media: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
  baixa: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400",
};

function hasCoords(g: GeoJSONGeometry | null | undefined): g is GeoJSONGeometry {
  return !!g && Array.isArray(g.coordinates) && g.coordinates.length > 0;
}

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 90
      ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
      : score >= 70
        ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
        : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400";
  return (
    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-bold ${color}`}>
      {score.toFixed(0)} / 100
    </span>
  );
}

function DiagnosticoScreen() {
  const { imovelId, municipio } = Route.useSearch();
  const navigate = useNavigate();

  const { data: diagnostico, isLoading: loadingDiag } = useQuery({
    queryKey: ["diagnostico", imovelId],
    queryFn: () => getDiagnostico(imovelId!),
    enabled: !!imovelId,
  });

  const { data: imovel, isLoading: loadingImovel } = useQuery({
    queryKey: ["imovel-detail", imovelId],
    queryFn: () => getImovel(imovelId!),
    enabled: !!imovelId,
  });

  const isLoading = loadingDiag || loadingImovel;
  const geometry = hasCoords(imovel?.poligonoDeclarado) ? imovel!.poligonoDeclarado : null;

  if (!imovelId) {
    return (
      <div className="flex flex-col h-[calc(100vh-64px)] items-center justify-center gap-4">
        <AlertTriangle className="w-10 h-10 text-amber-500" />
        <p className="text-muted-foreground">Nenhum imóvel selecionado.</p>
        <Button variant="outline" onClick={() => navigate({ to: "/" })}>
          Voltar ao painel
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-64px)] overflow-hidden">
        <div className="w-[420px] flex-shrink-0 p-5 space-y-4 border-r border-border">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
        <div className="flex-1 bg-muted/20 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  const score = diagnostico?.scoreConformidade ?? 100;
  const divergencias = diagnostico?.divergencias ?? [];
  const backTo = municipio ? `/mapa?municipio=${encodeURIComponent(municipio)}` : "/";

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden">
      {/* Left panel */}
      <div className="w-[420px] flex-shrink-0 flex flex-col border-r border-border bg-card overflow-y-auto">
        {/* Header */}
        <div className="p-5 border-b border-border">
          <Link
            to={municipio ? "/mapa" : "/"}
            search={municipio ? { municipio } : undefined}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-3 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Voltar ao mapa
          </Link>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-lg font-bold text-foreground">Diagnóstico</h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                {imovel?.municipio ?? "–"} — MG
              </p>
              <p className="text-[11px] text-muted-foreground font-mono truncate mt-0.5 max-w-[280px]">
                {imovel?.numeroCAR ?? imovelId}
              </p>
            </div>
            <ScoreBadge score={score} />
          </div>
        </div>

        {/* Summary */}
        <div className="p-5 border-b border-border">
          {divergencias.length === 0 ? (
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-8 h-8 text-green-500 shrink-0" />
              <div>
                <p className="font-semibold text-sm text-foreground">Nenhuma divergência detectada</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Este imóvel está em conformidade com as camadas de referência geradas.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-7 h-7 text-amber-500 shrink-0" />
              <div>
                <p className="font-semibold text-sm text-foreground">
                  {divergencias.length} divergência{divergencias.length > 1 ? "s" : ""} encontrada{divergencias.length > 1 ? "s" : ""}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Clique em uma divergência para iniciar o processo de correção.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Divergências list */}
        <div className="flex-1 divide-y divide-border">
          {divergencias.map((div) => (
            <div key={div.id} className="p-5 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <span className="font-semibold text-sm text-foreground">{div.tipo}</span>
                <Badge className={`text-xs font-medium border-0 shrink-0 ${SEV_CLASS[div.severidade]}`}>
                  {SEV_LABEL[div.severidade]}
                </Badge>
              </div>

              {div.areaHectares > 0 && (
                <p className="text-xs text-muted-foreground">
                  Área: <span className="font-mono font-medium">{div.areaHectares.toFixed(2)} ha</span>
                </p>
              )}

              <p className="text-sm text-foreground leading-relaxed bg-muted/40 rounded-lg p-3">
                {div.textoLinguagemSimples}
              </p>

              {div.baseLegal && (
                <p className="text-xs text-muted-foreground">
                  <span className="font-semibold">Base legal:</span> {div.baseLegal}
                </p>
              )}

              {div.caminhoRetificacao && (
                <div className="flex items-start gap-2 text-xs text-muted-foreground bg-primary/5 rounded-lg p-2.5 border border-primary/10">
                  <FileEdit className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                  <span>{div.caminhoRetificacao}</span>
                </div>
              )}

              <Link
                to="/retificacao"
                search={{ imovelId: imovelId!, divId: div.id }}
                className="flex items-center justify-between w-full p-3 rounded-xl border border-border hover:border-primary hover:bg-primary/5 transition-colors group"
              >
                <span className="text-sm font-semibold text-foreground">Iniciar correção</span>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </Link>
            </div>
          ))}
        </div>
      </div>

      {/* Right: satellite map */}
      <div className="flex-1 relative overflow-hidden bg-muted/20">
        {geometry && CarPreviewMap ? (
          <Suspense
            fallback={
              <div className="w-full h-full flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            }
          >
            <CarPreviewMap geometry={geometry} />
          </Suspense>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
            Mapa indisponível
          </div>
        )}
        {geometry && (
          <div className="absolute bottom-4 left-4 bg-black/60 text-white text-xs px-3 py-1.5 rounded-full backdrop-blur-sm">
            Polígono declarado — {imovel?.municipio}
          </div>
        )}
      </div>
    </div>
  );
}
