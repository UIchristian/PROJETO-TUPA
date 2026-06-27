import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getBaseReferencia } from "@/api";
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CountUp } from "@/components/CountUp";
import { ShieldAlert, ArrowLeft, Download, Database, Map, CheckCircle2 } from "lucide-react";
import { DecisaoFeicao } from "@/types/imovel";

type ExportarSearch = {
  municipio?: string;
};

export const Route = createFileRoute("/exportar")({
  validateSearch: (search: Record<string, unknown>): ExportarSearch => ({
    municipio: (search.municipio as string) || "Abadia Dos Dourados",
  }),
  component: ExportarScreen,
});

function ExportarScreen() {
  const { municipio } = Route.useSearch();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["baseReferencia", municipio],
    queryFn: () => getBaseReferencia(municipio || "Abadia Dos Dourados"),
  });

  const [sucesso, setSucesso] = useState(false);

  const resumo = useMemo(() => {
    if (!data?.feicoes) return null;

    let totalFeicoes = 0;
    let haApp = 0;
    let haReservaLegal = 0;
    let haUsoRestrito = 0;
    let countAlta = 0;
    let countMedia = 0;
    let countBaixa = 0;

    data.feicoes.forEach((f) => {
      totalFeicoes++;

      if (f.tipo.startsWith("APP_")) haApp += f.areaHectares;
      else if (f.tipo === "RESERVA_LEGAL_PROPOSTA") haReservaLegal += f.areaHectares;
      else if (f.tipo === "USO_RESTRITO_ENCOSTA") haUsoRestrito += f.areaHectares;

      if (f.confianca === "alta") countAlta++;
      else if (f.confianca === "media") countMedia++;
      else if (f.confianca === "baixa") countBaixa++;
    });

    const percAlta = totalFeicoes > 0 ? (countAlta / totalFeicoes) * 100 : 0;
    const percMedia = totalFeicoes > 0 ? (countMedia / totalFeicoes) * 100 : 0;
    const percBaixa = totalFeicoes > 0 ? (countBaixa / totalFeicoes) * 100 : 0;

    return {
      totalFeicoes,
      haApp,
      haReservaLegal,
      haUsoRestrito,
      percAlta,
      percMedia,
      percBaixa,
    };
  }, [data]);

  const baixarGeoJSON = () => {
    if (!data?.feicoes) return;

    let decisoesSalvas: Record<string, { decisao: DecisaoFeicao; observacao: string }> = {};
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("tupa_decisoes_feicao");
        if (saved) decisoesSalvas = JSON.parse(saved);
      } catch {
        // ignore
      }
    }

    const features = data.feicoes.map((f) => {
      const dec = decisoesSalvas[f.id]?.decisao || f.decisao || "pendente";

      return {
        type: "Feature",
        geometry: f.geometry,
        properties: {
          id: f.id,
          tipo: f.tipo,
          base_legal: f.baseLegal,
          area_hectares: f.areaHectares,
          confianca: f.confianca,
          decisao: dec,
        },
      };
    });

    const featureCollection = {
      type: "FeatureCollection",
      features,
    };

    const blob = new Blob([JSON.stringify(featureCollection)], { type: "application/geo+json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `base-referencia-${municipio?.toLowerCase().replace(/\s+/g, "-")}.geojson`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col h-[calc(100vh-64px)] p-8">
        <Skeleton className="h-8 w-64 mb-8" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (isError || !resumo) {
    return (
      <div className="flex flex-col h-[calc(100vh-64px)] items-center justify-center space-y-4">
        <ShieldAlert className="w-12 h-12 text-destructive" />
        <h2 className="text-xl font-bold">Erro ao carregar o resumo da base</h2>
        <Button onClick={() => refetch()}>Tentar Novamente</Button>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-muted/20 overflow-y-auto">
      <header className="px-8 py-6 border-b border-border bg-card">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <Button
              asChild
              variant="ghost"
              size="icon"
              className="h-8 w-8 -ml-2 text-muted-foreground"
            >
              <Link to="/mapa" search={{ municipio }}>
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <h1 className="text-2xl font-bold text-foreground">Exportar base de referência</h1>
          </div>
          <p className="text-sm text-muted-foreground pl-11">Resumo • {municipio}</p>
        </div>
      </header>

      <div className="p-8">
        <div className="max-w-5xl mx-auto space-y-8">
          {sucesso && (
            <div className="bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-800 p-6 rounded-lg flex items-center gap-4 animate-in fade-in slide-in-from-top-4">
              <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-500 shrink-0" />
              <div>
                <h3 className="text-lg font-bold text-green-900 dark:text-green-300">
                  Base gerada e exportada com sucesso!
                </h3>
                <p className="text-green-800 dark:text-green-400">
                  A Análise Dinamizada agora pode rodar aqui.
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Bloco de Resumo (Números) */}
            <Card className="shadow-sm">
              <CardHeader className="pb-4 border-b border-border">
                <CardTitle className="text-lg">Volume da Base</CardTitle>
                <CardDescription>Números totais gerados para o município</CardDescription>
              </CardHeader>
              <CardContent className="p-6 grid grid-cols-2 gap-6">
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Total de Feições</div>
                  <CountUp to={resumo.totalFeicoes} className="text-3xl font-bold" />
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">APP (ha)</div>
                  <CountUp
                    to={resumo.haApp}
                    format={(n) => n.toFixed(1)}
                    className="text-3xl font-bold font-mono"
                  />
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Reserva Legal (ha)</div>
                  <CountUp
                    to={resumo.haReservaLegal}
                    format={(n) => n.toFixed(1)}
                    className="text-3xl font-bold font-mono"
                  />
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Uso Restrito (ha)</div>
                  <CountUp
                    to={resumo.haUsoRestrito}
                    format={(n) => n.toFixed(1)}
                    className="text-3xl font-bold font-mono"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Bloco de Qualidade (Confiança) */}
            <Card className="shadow-sm">
              <CardHeader className="pb-4 border-b border-border">
                <CardTitle className="text-lg">Confiança do Motor</CardTitle>
                <CardDescription>Distribuição de qualidade das inferências</CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-[var(--conf-alta)] flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-[var(--conf-alta)]"></div>
                      Alta
                    </span>
                    <span className="font-mono font-bold">{resumo.percAlta.toFixed(1)}%</span>
                  </div>
                  <Progress value={resumo.percAlta} className="h-2 [&>div]:bg-[var(--conf-alta)]" />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-[var(--conf-media)] flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-[var(--conf-media)]"></div>
                      Média
                    </span>
                    <span className="font-mono font-bold">{resumo.percMedia.toFixed(1)}%</span>
                  </div>
                  <Progress
                    value={resumo.percMedia}
                    className="h-2 [&>div]:bg-[var(--conf-media)]"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-[var(--conf-baixa)] flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-[var(--conf-baixa)]"></div>
                      Baixa{" "}
                      <span className="text-xs text-muted-foreground font-normal ml-1">
                        (atenção da analista)
                      </span>
                    </span>
                    <span className="font-mono font-bold">{resumo.percBaixa.toFixed(1)}%</span>
                  </div>
                  <Progress
                    value={resumo.percBaixa}
                    className="h-2 [&>div]:bg-[var(--conf-baixa)]"
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Bloco de Exportação */}
          <Card className="shadow-sm">
            <CardHeader className="pb-4 border-b border-border">
              <CardTitle className="text-lg">Exportar e Disponibilizar</CardTitle>
              <CardDescription>Baixe a base ou integre aos sistemas via OGC</CardDescription>
            </CardHeader>
            <CardContent className="p-6 flex flex-col md:flex-row gap-4">
              <Button onClick={baixarGeoJSON} className="flex-1 py-8 h-auto flex flex-col gap-2">
                <Download className="w-6 h-6" />
                <div className="text-center">
                  <div className="font-bold text-base">Baixar base (GeoJSON)</div>
                  <div className="text-xs opacity-80 font-normal mt-0.5">
                    Arquivo local completo
                  </div>
                </div>
              </Button>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex-1">
                      <Button
                        disabled
                        variant="outline"
                        className="w-full h-full py-8 flex flex-col gap-2"
                      >
                        <Database className="w-6 h-6" />
                        <div className="text-center">
                          <div className="font-bold text-base">GeoPackage (OGC)</div>
                          <div className="text-xs opacity-80 font-normal mt-0.5">
                            Para QGIS/ArcGIS
                          </div>
                        </div>
                      </Button>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Disponível via serviço OGC (backend)</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex-1">
                      <Button
                        disabled
                        variant="outline"
                        className="w-full h-full py-8 flex flex-col gap-2"
                      >
                        <Map className="w-6 h-6" />
                        <div className="text-center">
                          <div className="font-bold text-base">Camadas WMS / WFS</div>
                          <div className="text-xs opacity-80 font-normal mt-0.5">
                            Integração em tempo real
                          </div>
                        </div>
                      </Button>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Disponível via serviço OGC (backend)</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </CardContent>
          </Card>

          <div className="flex justify-end pt-4">
            <Button size="lg" className="bg-primary px-8" onClick={() => setSucesso(true)}>
              Concluir e disponibilizar a base do município
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
