import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { getCoberturaMunicipios, getLimitesImovel } from "@/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { CountUp } from "@/components/CountUp";
import BaseReferenciaMap from "@/components/BaseReferenciaMap";
import { ShieldAlert, Info } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/")({
  component: PainelCoberturaScreen,
});

function PainelCoberturaScreen() {
  const navigate = useNavigate();
  const {
    data: municipios,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["coberturaMunicipios"],
    queryFn: getCoberturaMunicipios,
  });

  const [somenteSemBase, setSomenteSemBase] = useState(false);
  const [municipioSelecionado, setMunicipioSelecionado] = useState<string | null>(null);

  const { data: limitesData, isLoading: isLoadingLimites } = useQuery({
    queryKey: ["limitesImovel", municipioSelecionado],
    queryFn: () => getLimitesImovel(municipioSelecionado!),
    enabled: !!municipioSelecionado,
  });

  // Resumo e Filtros
  const { summary, filteredMunicipios } = useMemo(() => {
    if (!municipios)
      return { summary: { semBase: 0, imoveis: 0, hectares: 0 }, filteredMunicipios: [] };

    let semBase = 0;
    let imoveis = 0;
    let hectares = 0;
    let filtered = [...municipios];

    municipios.forEach((m) => {
      if (!m.temBaseReferencia) {
        semBase++;
        imoveis += m.imoveisImpactados;
        hectares += m.haSemCobertura;
      }
    });

    if (somenteSemBase) {
      filtered = filtered.filter((m) => !m.temBaseReferencia);
    }

    filtered.sort((a, b) => b.totalImoveis - a.totalImoveis);

    return { summary: { semBase, imoveis, hectares }, filteredMunicipios: filtered };
  }, [municipios, somenteSemBase]);

  const selecionadoInfo = useMemo(() => {
    return municipios?.find((m) => m.municipio === municipioSelecionado);
  }, [municipios, municipioSelecionado]);

  if (isLoading) {
    return (
      <div className="flex flex-col h-[calc(100vh-64px)] p-8">
        <Skeleton className="h-8 w-64 mb-8" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <Skeleton className="h-32 w-full col-span-3" />
          <Skeleton className="h-96 w-full col-span-2" />
          <Skeleton className="h-96 w-full col-span-1" />
        </div>
      </div>
    );
  }

  if (isError || !municipios) {
    return (
      <div className="flex flex-col h-[calc(100vh-64px)] items-center justify-center space-y-4">
        <ShieldAlert className="w-12 h-12 text-destructive" />
        <h2 className="text-xl font-bold">Erro ao carregar os municípios</h2>
        <Button onClick={() => refetch()}>Tentar Novamente</Button>
      </div>
    );
  }

  const handleGerarBase = () => {
    if (selecionadoInfo && !selecionadoInfo.temBaseReferencia) {
      navigate({ to: "/gerar", search: { municipio: selecionadoInfo.municipio } });
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-muted/20">
      <header className="px-8 py-6 border-b border-border bg-card">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl font-bold text-foreground">Painel de Cobertura</h1>
          <p className="text-sm text-muted-foreground">
            Municípios aguardando geração de base de referência para a Análise Dinamizada.
          </p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Resumo */}
          <Card className="shadow-sm">
            <CardHeader className="pb-4 border-b border-border">
              <CardTitle className="text-lg">Déficit de Cobertura Estadual</CardTitle>
              <CardDescription>Impacto nos municípios sem base de referência</CardDescription>
            </CardHeader>
            <CardContent className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <div className="text-sm text-muted-foreground mb-1">Municípios Sem Base</div>
                <CountUp to={summary.semBase} className="text-3xl font-bold" />
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">Imóveis Impactados</div>
                <CountUp to={summary.imoveis} className="text-3xl font-bold font-mono" />
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">Área Descoberta (ha)</div>
                <CountUp
                  to={summary.hectares}
                  format={(n) => n.toFixed(0)}
                  className="text-3xl font-bold font-mono"
                />
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Lista de Municípios */}
            <Card className="col-span-2 flex flex-col shadow-sm">
              <CardHeader className="pb-4 border-b border-border flex flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle className="text-lg">Municípios</CardTitle>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="filtro-sem-base"
                    checked={somenteSemBase}
                    onCheckedChange={setSomenteSemBase}
                  />
                  <label
                    htmlFor="filtro-sem-base"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Somente sem base
                  </label>
                </div>
              </CardHeader>
              <CardContent className="p-0 overflow-hidden flex flex-col">
                <div className="overflow-y-auto max-h-[500px]">
                  <Table>
                    <TableHeader className="bg-muted/50 sticky top-0 z-10 shadow-sm">
                      <TableRow>
                        <TableHead>Município</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Nº Imóveis</TableHead>
                        <TableHead className="text-right">Área S/ Base (ha)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredMunicipios.map((m) => (
                        <TableRow
                          key={m.municipio}
                          className={`cursor-pointer transition-colors ${municipioSelecionado === m.municipio ? "bg-primary/5 hover:bg-primary/10" : ""}`}
                          onClick={() => setMunicipioSelecionado(m.municipio)}
                        >
                          <TableCell className="font-medium">
                            {m.municipio} - {m.uf}
                          </TableCell>
                          <TableCell>
                            {m.temBaseReferencia ? (
                              <Badge className="bg-[var(--conf-alta)] text-white hover:bg-[var(--conf-alta)]/90">
                                Com base
                              </Badge>
                            ) : (
                              <Badge className="bg-[var(--conf-baixa)] text-white hover:bg-[var(--conf-baixa)]/90">
                                Sem base
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono">{m.totalImoveis}</TableCell>
                          <TableCell className="text-right font-mono text-muted-foreground">
                            {m.haSemCobertura > 0 ? m.haSemCobertura.toLocaleString("pt-BR") : "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Preview do Mapa e Ações */}
            <Card className="col-span-1 shadow-sm flex flex-col">
              <CardHeader className="pb-4 border-b border-border">
                <CardTitle className="text-lg">Prévia Espacial</CardTitle>
                <CardDescription>
                  {municipioSelecionado ? municipioSelecionado : "Selecione um município na lista"}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0 flex-1 relative min-h-[300px] flex flex-col">
                {!municipioSelecionado ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-muted-foreground bg-muted/10">
                    <Info className="w-8 h-8 mb-2 opacity-50" />
                    <p className="text-sm">
                      Selecione um município para visualizar seus limites territoriais.
                    </p>
                  </div>
                ) : isLoadingLimites ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-muted/10">
                    <Skeleton className="w-full h-full" />
                  </div>
                ) : !limitesData || limitesData.length === 0 ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-muted-foreground bg-muted/10">
                    <Info className="w-8 h-8 mb-2 opacity-50" />
                    <p className="text-sm">Prévia indisponível para este município.</p>
                  </div>
                ) : (
                  <div className="flex-1 w-full relative">
                    <BaseReferenciaMap
                      limites={limitesData}
                      feicoes={[]}
                      tiposVisiveis={new Set()}
                      confiancasVisiveis={new Set()}
                      vigencia={2026}
                    />
                  </div>
                )}
              </CardContent>
              <div className="p-4 border-t border-border bg-card">
                <Button
                  className="w-full"
                  size="lg"
                  disabled={!selecionadoInfo || selecionadoInfo.temBaseReferencia}
                  onClick={handleGerarBase}
                >
                  Gerar base de referência
                </Button>
                {selecionadoInfo && selecionadoInfo.temBaseReferencia && (
                  <p className="text-xs text-center text-muted-foreground mt-2">
                    Este município já possui base de referência.
                  </p>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
