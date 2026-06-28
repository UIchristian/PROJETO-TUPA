import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Map as MapIcon, CheckCircle2, AlertTriangle, Info } from "lucide-react";

import { buscarCarPorNumero, getBaseReferencia } from "@/api";
import type { TipoFeicao, NivelConfianca } from "@/types/imovel";
import BaseReferenciaMap from "@/components/BaseReferenciaMap";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/portal/imovel/$car")({
  component: ImovelPortalView,
});

function ImovelPortalView() {
  const { car } = Route.useParams();

  // 1. Fetch Imóvel data
  const {
    data: imovel,
    isLoading: isLoadingImovel,
    error: errorImovel,
  } = useQuery({
    queryKey: ["portal", "imovel", car],
    queryFn: () => buscarCarPorNumero(car),
  });

  // 2. Fetch Base Referência based on municipio
  const municipio = imovel?.municipio || "";
  const { data: base, isLoading: isLoadingBase } = useQuery({
    queryKey: ["portal", "base", municipio],
    queryFn: () => getBaseReferencia(municipio),
    enabled: !!municipio,
  });

  const [retificacaoEnviada, setRetificacaoEnviada] = useState(false);
  const [tipoDivergencia, setTipoDivergencia] = useState("");
  const [observacao, setObservacao] = useState("");

  const handleEnviarRetificacao = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tipoDivergencia) return;

    // Save to localStorage as requested
    const existing = JSON.parse(localStorage.getItem("tupa_retificacoes") || "[]");
    existing.push({
      car,
      tipoDivergencia,
      observacao,
      data: new Date().toISOString(),
    });
    localStorage.setItem("tupa_retificacoes", JSON.stringify(existing));

    setRetificacaoEnviada(true);
  };

  if (isLoadingImovel || (imovel && isLoadingBase)) {
    return (
      <div className="flex-1 w-full bg-muted/20 p-4 md:p-8 space-y-6">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-[45vh] w-full rounded-2xl" />
        <div className="grid md:grid-cols-2 gap-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    );
  }

  if (errorImovel || !imovel) {
    return (
      <div className="flex-1 w-full bg-muted/20 flex items-center justify-center p-4">
        <div className="max-w-md text-center">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-foreground mb-2">Imóvel não encontrado</h2>
          <p className="text-muted-foreground mb-6">
            Não conseguimos localizar as informações para o CAR informado. Verifique se o número
            está correto.
          </p>
          <Button asChild>
            <Link to="/portal">Voltar para a busca</Link>
          </Button>
        </div>
      </div>
    );
  }

  // Prepara dados do mapa
  // Queremos mostrar TUDO no portal do produtor
  const tiposVisiveis = new Set<TipoFeicao>([
    "APP_CURSO_DAGUA",
    "APP_NASCENTE",
    "APP_LAGO",
    "APP_VEREDA",
    "USO_RESTRITO_ENCOSTA",
    "RESERVA_LEGAL_PROPOSTA",
    "COBERTURA",
  ]);
  const confiancasVisiveis = new Set<NivelConfianca>(["alta", "media", "baixa"]);

  // Processar sumário para os cartões
  const feicoesDoImovel = base?.feicoes.filter((f) => f.car === car) || [];

  // Dicionário de tradução
  const translateFeicao = (tipo: string) => {
    if (tipo.startsWith("APP_")) return "Áreas de preservação (rios e nascentes)";
    if (tipo === "RESERVA_LEGAL_PROPOSTA") return "Sua Reserva Legal";
    if (tipo === "USO_RESTRITO_ENCOSTA") return "Áreas de uso restrito (encostas)";
    if (tipo === "COBERTURA") return "Cobertura da sua terra";
    return tipo;
  };

  // Calcula áreas para o resumo
  let areaPreservacao = 0;
  let areaReserva = 0;
  let temBaixaConfianca = false;

  feicoesDoImovel.forEach((f) => {
    if (f.tipo.startsWith("APP_")) areaPreservacao += f.areaHectares;
    if (f.tipo === "RESERVA_LEGAL_PROPOSTA") areaReserva += f.areaHectares;
    if (f.confianca === "baixa") temBaixaConfianca = true;
  });

  return (
    <div className="flex-1 w-full bg-muted/20">
      <div className="max-w-5xl mx-auto px-4 py-6 md:py-8 space-y-6">
        {/* Cabeçalho */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild className="rounded-full">
            <Link to="/portal">
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground leading-tight">Sua propriedade</h1>
            <p className="text-sm text-muted-foreground font-mono">{imovel.numeroCAR}</p>
          </div>
        </div>

        {/* Mapa */}
        <div className="bg-card text-card-foreground p-2 rounded-2xl shadow-sm border border-border flex flex-col">
          <div className="h-[45vh] md:h-[60vh] w-full rounded-xl overflow-hidden relative">
            {base && (
              <BaseReferenciaMap
                limites={base.limites.filter((l) => l.numeroCar === car)}
                feicoes={feicoesDoImovel}
                tiposVisiveis={tiposVisiveis}
                confiancasVisiveis={confiancasVisiveis}
              />
            )}

            {/* Legenda Flutuante simplificada */}
            <div className="absolute bottom-4 left-4 bg-card/90 backdrop-blur-sm p-3 rounded-lg shadow-lg border border-border z-[1000] text-xs pointer-events-none">
              <div className="font-semibold text-foreground mb-2">O que as cores significam:</div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-cyan-400 rounded-sm"></div>
                  <span>Preservação (Rios/Nascentes)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 border-2 border-dashed border-green-700 rounded-sm"></div>
                  <span>Reserva Legal</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-orange-500 rounded-sm"></div>
                  <span>Uso restrito (Encostas)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 border-2 border-dashed border-red-500 rounded-sm"></div>
                  <span>Precisa de verificação (atenção)</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Cartões de Resumo */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-border shadow-sm transition-all hover:shadow-md hover:-translate-y-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground font-medium">
                Área total aproximada
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {imovel.areaHectares.toFixed(1)} ha
              </div>
            </CardContent>
          </Card>

          <Card className="border-border shadow-sm bg-cyan-50/50 dark:bg-cyan-900/10 transition-all hover:shadow-md hover:-translate-y-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-cyan-800 font-medium">
                Áreas de preservação
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-cyan-900 dark:text-cyan-400">
                {areaPreservacao.toFixed(1)} ha
              </div>
              <p className="text-xs text-cyan-700 dark:text-cyan-500 mt-1">Ao longo de rios e nascentes</p>
            </CardContent>
          </Card>

          <Card className="border-border shadow-sm bg-green-50/50 dark:bg-green-900/10 transition-all hover:shadow-md hover:-translate-y-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-green-800 font-medium">
                Sua Reserva Legal
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-900 dark:text-green-400">{areaReserva.toFixed(1)} ha</div>
              <p className="text-xs text-green-700 dark:text-green-500 mt-1">Área que deve manter vegetação</p>
            </CardContent>
          </Card>

          <Card
            className={`border-border shadow-sm transition-all hover:shadow-md hover:-translate-y-1 ${temBaixaConfianca ? "bg-amber-50/50 dark:bg-amber-900/10" : "bg-muted/50"}`}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2 text-foreground">
                Pontos de atenção
                {temBaixaConfianca && <AlertTriangle className="w-4 h-4 text-amber-500" />}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground font-medium mt-1">
                {temBaixaConfianca
                  ? "Algumas áreas precisam de verificação."
                  : "Tudo parece correto pelas imagens."}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Retificação */}
        <div className="bg-card text-card-foreground p-6 md:p-8 rounded-2xl shadow-sm border border-border mt-8">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 flex items-center justify-center shrink-0 mt-1">
              <Info className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">
                As informações batem com a sua propriedade?
              </h2>
              <p className="text-muted-foreground text-sm mt-1">
                Se algo estiver diferente da realidade (por exemplo, um rio que secou ou uma encosta
                que não existe), você pode solicitar uma correção. Um de nossos analistas vai
                avaliar o seu pedido.
              </p>
            </div>
          </div>

          {retificacaoEnviada ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-center flex flex-col items-center">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mb-3" />
              <h3 className="font-bold text-emerald-800 text-lg">
                Sua solicitação foi enviada para análise!
              </h3>
              <p className="text-emerald-700 text-sm mt-2">
                Nossos analistas do órgão ambiental receberam o seu pedido e irão verificar as
                imagens de satélite.
              </p>
              <Button
                variant="outline"
                className="mt-6"
                onClick={() => setRetificacaoEnviada(false)}
              >
                Enviar nova correção
              </Button>
            </div>
          ) : (
            <form onSubmit={handleEnviarRetificacao} className="space-y-4 max-w-2xl">
              <div className="space-y-2">
                <Label htmlFor="tipo">O que está diferente?</Label>
                <Select value={tipoDivergencia} onValueChange={setTipoDivergencia} required>
                  <SelectTrigger id="tipo">
                    <SelectValue placeholder="Selecione a área com diferença" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="APP">Áreas de preservação (rios e nascentes)</SelectItem>
                    <SelectItem value="RESERVA_LEGAL">Sua Reserva Legal</SelectItem>
                    <SelectItem value="USO_RESTRITO">Áreas de uso restrito (encostas)</SelectItem>
                    <SelectItem value="COBERTURA">Cobertura da terra (mata, pasto, etc)</SelectItem>
                    <SelectItem value="OUTRO">Outro assunto</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="obs">Detalhe o que está diferente (opcional)</Label>
                <Textarea
                  id="obs"
                  placeholder="Ex: O rio marcado no mapa já não existe há muitos anos..."
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                  className="min-h-[100px]"
                />
              </div>

              <Button
                type="submit"
                className="w-full sm:w-auto"
              >
                Solicitar Correção
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
