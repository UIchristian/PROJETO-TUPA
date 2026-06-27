import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getBaseReferencia } from "@/api";
import { useState, useMemo, useEffect, useRef } from "react";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import BaseReferenciaMap from "@/components/BaseReferenciaMap";
import { FeicaoReferencia, TipoFeicao, NivelConfianca, DecisaoFeicao } from "@/types/imovel";
import { EnquadramentoRLDialog } from "@/components/EnquadramentoRLDialog";
import { Layers, ShieldAlert, ArrowRight, Info, AlertTriangle, Scale } from "lucide-react";

type MapaSearch = {
  municipio?: string;
};

export const Route = createFileRoute("/mapa")({
  validateSearch: (search: Record<string, unknown>): MapaSearch => ({
    municipio: (search.municipio as string) || "Abadia Dos Dourados",
  }),
  component: MapaScreen,
});

const LABELS_TIPO: Record<string, string> = {
  APP_CURSO_DAGUA: "APP curso d'água",
  APP_NASCENTE: "APP nascente",
  APP_LAGO: "APP lago",
  APP_VEREDA: "APP vereda",
  USO_RESTRITO_ENCOSTA: "Uso restrito",
  RESERVA_LEGAL_PROPOSTA: "Reserva Legal",
  COBERTURA: "Cobertura do solo",
};

const COLORS_TIPO: Record<string, string> = {
  APP_CURSO_DAGUA: "var(--app)",
  APP_NASCENTE: "var(--app)",
  APP_LAGO: "var(--app)",
  APP_VEREDA: "var(--app)",
  USO_RESTRITO_ENCOSTA: "var(--uso-restrito)",
  RESERVA_LEGAL_PROPOSTA: "var(--rl)",
  COBERTURA: "var(--rl)",
};

const COLORS_CONF: Record<string, string> = {
  alta: "var(--conf-alta)",
  media: "var(--conf-media)",
  baixa: "var(--conf-baixa)",
};

type DecisoesFeicao = Record<string, { decisao: DecisaoFeicao; observacao: string }>;

function MapaScreen() {
  const { municipio } = Route.useSearch();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["baseReferencia", municipio],
    queryFn: () => getBaseReferencia(municipio || "Abadia Dos Dourados"),
  });

  const [tiposVisiveis, setTiposVisiveis] = useState<Set<TipoFeicao>>(new Set());
  const [confiancasVisiveis, setConfiancasVisiveis] = useState<Set<NivelConfianca>>(
    new Set(["alta", "media", "baixa"]),
  );
  const [vigencia, setVigencia] = useState<number>(new Date().getFullYear());
  const [selectedFeicaoId, setSelectedFeicaoId] = useState<string | null>(null);

  const [isRLDialogOpen, setIsRLDialogOpen] = useState(false);

  // Initialize visible types with all available types from data (runs once per data fetch/municipio)
  const initializedMunicipio = useRef<string | null>(null);
  useEffect(() => {
    if (data && initializedMunicipio.current !== municipio) {
      initializedMunicipio.current = municipio || null;
      const allTipos = new Set(data.feicoes.map((f) => f.tipo));
      setTiposVisiveis(allTipos);
      setSelectedFeicaoId(null);
    }
  }, [data, municipio]);

  // Estado de Decisões do LocalStorage
  const [decisoes, setDecisoes] = useState<DecisoesFeicao>(() => {
    if (typeof window === "undefined") return {};
    try {
      const saved = localStorage.getItem("tupa_decisoes_feicao");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const salvarDecisao = (feicaoId: string, decisao: DecisaoFeicao, observacao: string) => {
    const next = { ...decisoes, [feicaoId]: { decisao, observacao } };
    setDecisoes(next);
    try {
      localStorage.setItem("tupa_decisoes_feicao", JSON.stringify(next));
    } catch (e) {
      console.error("Failed to save decisoes", e);
    }
  };

  const feicoesComDecisao = useMemo(() => {
    if (!data) return [];
    return data.feicoes.map((f) => {
      const dec = decisoes[f.id];
      return {
        ...f,
        decisao: dec?.decisao || "pendente",
        observacao: dec?.observacao || "",
      };
    });
  }, [data, decisoes]);

  const selectedFeicao = useMemo(() => {
    return feicoesComDecisao.find((f) => f.id === selectedFeicaoId) || null;
  }, [feicoesComDecisao, selectedFeicaoId]);

  // Texto temporário da observação
  const [obsLocal, setObsLocal] = useState("");
  useEffect(() => {
    setObsLocal(selectedFeicao?.observacao || "");
  }, [selectedFeicao?.id, selectedFeicao?.observacao]);

  const feicoesPresentes = useMemo(() => {
    if (!feicoesComDecisao) return [];
    const agrupado = feicoesComDecisao.reduce(
      (acc, f) => {
        if (!acc[f.tipo]) acc[f.tipo] = { count: 0, confs: { alta: 0, media: 0, baixa: 0 } };
        acc[f.tipo].count++;
        acc[f.tipo].confs[f.confianca]++;
        return acc;
      },
      {} as Record<string, { count: number; confs: Record<string, number> }>,
    );

    return Object.entries(agrupado)
      .map(([tipo, info]) => {
        const predominante = Object.entries(info.confs).reduce((a, b) =>
          a[1] > b[1] ? a : b,
        )[0] as NivelConfianca;
        return { tipo: tipo as TipoFeicao, predominante, count: info.count };
      })
      .sort((a, b) => a.tipo.localeCompare(b.tipo));
  }, [feicoesComDecisao]);

  if (isLoading) {
    return (
      <div className="flex flex-col h-[calc(100vh-64px)]">
        <header className="px-6 py-4 border-b bg-background">
          <Skeleton className="h-6 w-64" />
        </header>
        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 p-4">
            <Skeleton className="h-full w-full rounded-md" />
          </div>
          <aside className="w-80 border-l p-4 space-y-4">
            <Skeleton className="h-40 w-full" />
          </aside>
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex flex-col h-[calc(100vh-64px)] items-center justify-center space-y-4">
        <ShieldAlert className="w-12 h-12 text-destructive" />
        <h2 className="text-xl font-bold">Erro ao carregar base de referência</h2>
        <Button onClick={() => refetch()}>Tentar Novamente</Button>
      </div>
    );
  }

  const isEmpty = data.feicoes.length === 0;

  const toggleTipo = (tipo: TipoFeicao) => {
    const next = new Set(tiposVisiveis);
    if (next.has(tipo)) next.delete(tipo);
    else next.add(tipo);
    setTiposVisiveis(next);
  };

  const toggleConfianca = (conf: NivelConfianca) => {
    const next = new Set(confiancasVisiveis);
    if (next.has(conf)) next.delete(conf);
    else next.add(conf);
    setConfiancasVisiveis(next);
  };

  const getBadgeProps = (decisao?: DecisaoFeicao) => {
    switch (decisao) {
      case "validada":
        return {
          variant: "default" as const,
          className: "bg-green-600 hover:bg-green-700 text-white",
        };
      case "ajustada":
        return {
          variant: "default" as const,
          className: "bg-amber-500 hover:bg-amber-600 text-white",
        };
      case "rejeitada":
        return { variant: "destructive" as const };
      default:
        return { variant: "secondary" as const, className: "text-muted-foreground" };
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      <header className="px-6 py-4 border-b border-border bg-card flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-foreground">Base de referência gerada</h1>
          <p className="text-sm text-muted-foreground">{municipio}</p>
        </div>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div>
                <Button disabled variant="outline" className="gap-2">
                  Ir para exportação <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Disponível na etapa de exportação</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 relative">
          {isEmpty ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 bg-muted/20">
              <Info className="w-12 h-12 text-muted-foreground mb-4" />
              <h2 className="text-lg font-medium">Nenhuma feição encontrada</h2>
              <p className="text-muted-foreground">
                Não há feições mapeadas para a base de referência de {municipio}.
              </p>
            </div>
          ) : (
            <BaseReferenciaMap
              limites={data.limites}
              feicoes={feicoesComDecisao}
              tiposVisiveis={tiposVisiveis}
              confiancasVisiveis={confiancasVisiveis}
              selectedId={selectedFeicao?.id}
              onSelectFeicao={(f) => setSelectedFeicaoId(f.id)}
            />
          )}
        </div>

        <aside className="w-[380px] border-l border-border bg-card flex flex-col overflow-y-auto">
          <div className="p-5 border-b border-border">
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <Layers className="w-4 h-4" /> Camadas da Base
            </h3>
            <div className="space-y-3">
              {feicoesPresentes.map((f) => {
                const label = LABELS_TIPO[f.tipo] || f.tipo;
                const cor = COLORS_TIPO[f.tipo] || "#ccc";
                return (
                  <div key={f.tipo} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-4 h-4 rounded-sm shrink-0 border border-border"
                        style={{ backgroundColor: cor }}
                      />
                      <span className="text-sm">
                        {label} <span className="text-muted-foreground text-xs">({f.count})</span>
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge
                        variant="outline"
                        style={{
                          borderColor: COLORS_CONF[f.predominante],
                          color: COLORS_CONF[f.predominante],
                        }}
                        className="capitalize text-[10px] h-5 px-1.5 rounded-sm"
                      >
                        {f.predominante}
                      </Badge>
                      <Switch
                        checked={tiposVisiveis.has(f.tipo)}
                        onCheckedChange={() => toggleTipo(f.tipo)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="p-5 border-b border-border">
            <h3 className="text-sm font-semibold mb-4">Filtrar por Confiança</h3>
            <div className="flex gap-2">
              {(["alta", "media", "baixa"] as NivelConfianca[]).map((c) => {
                const active = confiancasVisiveis.has(c);
                return (
                  <button
                    key={c}
                    onClick={() => toggleConfianca(c)}
                    className={`flex-1 py-1.5 text-xs font-medium rounded-md border transition-all ${active ? "bg-muted text-foreground" : "text-muted-foreground opacity-50"}`}
                    style={{ borderColor: active ? COLORS_CONF[c] : "transparent" }}
                  >
                    <span className="capitalize">{c}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="p-5 border-b border-border">
            <h3 className="text-sm font-semibold mb-4">Linha do tempo (vigência)</h3>
            <div className="px-2">
              <Slider
                min={2008}
                max={new Date().getFullYear()}
                step={1}
                value={[vigencia]}
                onValueChange={(val) => setVigencia(val[0])}
              />
              <div className="flex justify-between mt-2 text-xs text-muted-foreground font-mono">
                <span>2008</span>
                <span className="text-foreground font-bold">{vigencia}</span>
                <span>{new Date().getFullYear()}</span>
              </div>
            </div>
          </div>

          <div className="p-5 flex-1 bg-muted/10">
            {selectedFeicao ? (
              <Card className="p-4 shadow-sm border-border">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-sm">
                        {LABELS_TIPO[selectedFeicao.tipo] || selectedFeicao.tipo}
                      </h4>
                      <Badge
                        {...getBadgeProps(selectedFeicao.decisao)}
                        className="capitalize text-[10px] h-5 px-1.5 rounded-sm"
                      >
                        {selectedFeicao.decisao}
                      </Badge>
                    </div>
                    {selectedFeicao.subclasse && (
                      <span className="text-xs text-muted-foreground block mt-0.5">
                        {selectedFeicao.subclasse}
                      </span>
                    )}
                  </div>
                  <Badge
                    variant="outline"
                    style={{
                      borderColor: COLORS_CONF[selectedFeicao.confianca],
                      color: COLORS_CONF[selectedFeicao.confianca],
                    }}
                    className="capitalize"
                  >
                    {selectedFeicao.confianca}
                  </Badge>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground text-xs">Área:</span>
                    <span className="font-mono">{selectedFeicao.areaHectares.toFixed(2)} ha</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-muted-foreground text-xs mb-0.5">Base Legal:</span>
                    <span className="text-xs leading-snug">{selectedFeicao.baseLegal}</span>
                  </div>
                  {selectedFeicao.confiancaMotivo && selectedFeicao.confianca === "baixa" && (
                    <div className="flex items-start gap-2 mt-3 p-2 bg-muted/50 rounded-md border border-border">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500 mt-0.5" />
                      <p className="text-xs text-muted-foreground leading-snug">
                        {selectedFeicao.confiancaMotivo}
                      </p>
                    </div>
                  )}
                </div>

                {/* Validation Panel */}
                <div className="mt-4 pt-4 border-t border-border space-y-3">
                  {selectedFeicao.tipo === "RESERVA_LEGAL_PROPOSTA" && (
                    <Button
                      variant="outline"
                      className="w-full justify-center bg-primary/5 text-primary hover:bg-primary/10 hover:text-primary border-primary/20"
                      onClick={() => setIsRLDialogOpen(true)}
                    >
                      <Scale className="w-4 h-4 mr-2" />
                      Ver enquadramento da Reserva Legal
                    </Button>
                  )}

                  <Textarea
                    placeholder="Observação da analista (opcional)"
                    value={obsLocal}
                    onChange={(e) => setObsLocal(e.target.value)}
                    className="text-xs min-h-[60px] resize-none"
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={selectedFeicao.decisao === "validada" ? "default" : "outline"}
                      className={
                        selectedFeicao.decisao === "validada"
                          ? "bg-green-600 hover:bg-green-700 flex-1 text-white"
                          : "flex-1"
                      }
                      onClick={() => salvarDecisao(selectedFeicao.id, "validada", obsLocal)}
                    >
                      Validar
                    </Button>
                    <Button
                      size="sm"
                      variant={selectedFeicao.decisao === "ajustada" ? "default" : "outline"}
                      className={
                        selectedFeicao.decisao === "ajustada"
                          ? "bg-amber-500 hover:bg-amber-600 flex-1 text-white"
                          : "flex-1"
                      }
                      onClick={() => salvarDecisao(selectedFeicao.id, "ajustada", obsLocal)}
                    >
                      Ajustar
                    </Button>
                    <Button
                      size="sm"
                      variant={selectedFeicao.decisao === "rejeitada" ? "destructive" : "outline"}
                      className="flex-1"
                      onClick={() => salvarDecisao(selectedFeicao.id, "rejeitada", obsLocal)}
                    >
                      Rejeitar
                    </Button>
                  </div>
                </div>
              </Card>
            ) : (
              <div className="h-full flex items-center justify-center text-center p-4">
                <p className="text-sm text-muted-foreground">
                  Clique em uma feição no mapa para ver detalhes e validar.
                </p>
              </div>
            )}
          </div>
        </aside>
      </div>

      {selectedFeicao &&
        selectedFeicao.tipo === "RESERVA_LEGAL_PROPOSTA" &&
        selectedFeicao.imovelId && (
          <EnquadramentoRLDialog
            isOpen={isRLDialogOpen}
            onOpenChange={setIsRLDialogOpen}
            imovelId={selectedFeicao.imovelId}
            feicaoId={selectedFeicao.id}
            onValidar={(feicaoId) => {
              salvarDecisao(feicaoId, "validada", obsLocal);
              setIsRLDialogOpen(false);
            }}
          />
        )}
    </div>
  );
}
