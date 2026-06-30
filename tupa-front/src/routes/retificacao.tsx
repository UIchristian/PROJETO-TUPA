import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, lazy, Suspense } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppState } from "@/lib/app-store";
import { getDiagnostico, getImovel } from "@/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowLeft,
  FileEdit,
  ChevronRight,
  MessageSquare,
  MapPin,
  Bell,
  Send,
} from "lucide-react";
import type { Divergencia, GeoJSONGeometry } from "@/types/imovel";

const CarPreviewMap = !import.meta.env.SSR
  ? lazy(() => import("@/components/CarPreviewMap"))
  : null;

type RetificacaoSearch = {
  imovelId?: string;
  divId?: string;
};

export const Route = createFileRoute("/retificacao")({
  validateSearch: (search: Record<string, unknown>): RetificacaoSearch => ({
    imovelId: (search.imovelId as string) || undefined,
    divId: (search.divId as string) || undefined,
  }),
  component: RetificacaoScreen,
});

type Etapa = "selecao" | "concordo" | "nao_concordo" | "concluido";

const SEVERITY_LABEL: Record<string, string> = {
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
};

const SEVERITY_CLASS: Record<string, string> = {
  alta: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
  media: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
  baixa: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400",
};

function hasCoords(g: GeoJSONGeometry | null | undefined): g is GeoJSONGeometry {
  return !!g && Array.isArray(g.coordinates) && g.coordinates.length > 0;
}

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

function RetificacaoScreen() {
  const { imovelId, divId } = Route.useSearch();
  const navigate = useNavigate();
  const { backofficeUser } = useAppState();
  const queryClient = useQueryClient();

  const [etapa, setEtapa] = useState<Etapa>("selecao");
  const [justificativa, setJustificativa] = useState("");

  // Notificação ao agricultor
  const [notifMensagem, setNotifMensagem] = useState("");
  const [notifTipo, setNotifTipo] = useState("pendencia");
  const [notifPrioridade, setNotifPrioridade] = useState("media");
  const [notifEnviada, setNotifEnviada] = useState(false);

  const enviarNotificacao = useMutation({
    mutationFn: async (car: string) => {
      const res = await fetch(`${BASE_URL}/notificacao/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          car,
          mensagem: notifMensagem,
          tipo: notifTipo,
          prioridade: notifPrioridade,
          analista_nome: backofficeUser.nome,
        }),
      });
      if (!res.ok) throw new Error("Erro ao enviar notificação");
      return res.json();
    },
    onSuccess: () => {
      setNotifEnviada(true);
      setNotifMensagem("");
      queryClient.invalidateQueries({ queryKey: ["portal", "notificacoes"] });
    },
  });

  const { data: imovel, isLoading: loadingImovel } = useQuery({
    queryKey: ["imovel-detail", imovelId],
    queryFn: () => getImovel(imovelId!),
    enabled: !!imovelId,
  });

  const { data: diagnostico, isLoading: loadingDiag } = useQuery({
    queryKey: ["diagnostico", imovelId],
    queryFn: () => getDiagnostico(imovelId!),
    enabled: !!imovelId,
  });

  const isLoading = loadingImovel || loadingDiag;

  // Select the divergência to display
  const divergencia: Divergencia | null =
    diagnostico?.divergencias.find((d) => d.id === divId) ?? diagnostico?.divergencias[0] ?? null;

  const mapGeometry: GeoJSONGeometry | null = hasCoords(divergencia?.poligonoDivergencia)
    ? divergencia!.poligonoDivergencia
    : hasCoords(imovel?.poligonoDeclarado)
      ? imovel!.poligonoDeclarado
      : null;

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
      <div className="flex flex-col h-[calc(100vh-64px)] items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Carregando divergência…</p>
      </div>
    );
  }

  if (!divergencia) {
    return (
      <div className="flex flex-col h-[calc(100vh-64px)] items-center justify-center gap-4">
        <CheckCircle2 className="w-10 h-10 text-green-500" />
        <p className="font-semibold">Nenhuma divergência encontrada neste imóvel.</p>
        <Button variant="outline" onClick={() => navigate({ to: "/" })}>
          Voltar ao painel
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden">
      {/* Left: info + actions */}
      <div className="w-[420px] flex-shrink-0 flex flex-col border-r border-border bg-card overflow-y-auto">
        {/* Header */}
        <div className="p-5 border-b border-border">
          <button
            onClick={() => navigate({ to: "/" })}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-3 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Voltar ao painel
          </button>
          <h1 className="text-lg font-bold text-foreground">Iniciar correção</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{imovel?.municipio} — MG</p>
          <p className="text-xs text-muted-foreground font-mono truncate mt-0.5">
            {imovel?.numeroCAR}
          </p>
        </div>

        {/* Divergência card */}
        <div className="p-5 border-b border-border space-y-3">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/40 shrink-0">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm text-foreground">{divergencia.tipo}</span>
                <Badge
                  className={`text-xs font-medium border-0 ${SEVERITY_CLASS[divergencia.severidade]}`}
                >
                  Severidade {SEVERITY_LABEL[divergencia.severidade]}
                </Badge>
              </div>
              {divergencia.areaHectares > 0 && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Área afetada:{" "}
                  <span className="font-mono font-medium">
                    {divergencia.areaHectares.toFixed(2)} ha
                  </span>
                </p>
              )}
            </div>
          </div>

          <div className="bg-muted/40 rounded-lg p-3 text-sm text-foreground leading-relaxed">
            {divergencia.textoLinguagemSimples}
          </div>

          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <span className="font-semibold shrink-0">Base legal:</span>
            <span>{divergencia.baseLegal}</span>
          </div>
        </div>

        {/* Action area */}
        <div className="flex-1 p-5">
          {etapa === "selecao" && (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-foreground">Como deseja prosseguir?</p>

              <button
                onClick={() => setEtapa("concordo")}
                className="w-full flex items-center gap-3 p-4 rounded-xl border border-border hover:border-primary hover:bg-primary/5 transition-colors text-left group"
              >
                <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/40 group-hover:bg-green-200 transition-colors">
                  <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-foreground">
                    Concordo e quero corrigir
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    A divergência existe — vejo como regularizar
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </button>

              <button
                onClick={() => setEtapa("nao_concordo")}
                className="w-full flex items-center gap-3 p-4 rounded-xl border border-border hover:border-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/20 transition-colors text-left group"
              >
                <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/40 group-hover:bg-red-200 transition-colors">
                  <XCircle className="w-5 h-5 text-red-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-foreground">Não concordo</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Informar motivo da contestação
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-amber-500 transition-colors" />
              </button>
            </div>
          )}

          {etapa === "concordo" && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <CheckCircle2 className="w-5 h-5" />
                <span className="font-semibold text-sm">Concordo e quero corrigir</span>
              </div>

              <div className="bg-muted/40 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <FileEdit className="w-4 h-4 text-primary" />
                  <span className="text-sm font-semibold text-foreground">
                    Caminho de regularização
                  </span>
                </div>
                <p className="text-sm text-foreground leading-relaxed">
                  {divergencia.caminhoRetificacao}
                </p>
              </div>

              <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 rounded-lg p-3 text-xs text-amber-800 dark:text-amber-400">
                A correção definitiva deve ser feita no sistema SICAR oficial. Esta análise é um
                rascunho de referência.
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEtapa("selecao")}
                  className="flex-1"
                >
                  Voltar
                </Button>
                <Button size="sm" onClick={() => navigate({ to: "/" })} className="flex-1 gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> Concluir
                </Button>
              </div>
            </div>
          )}

          {etapa === "nao_concordo" && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-red-500">
                <XCircle className="w-5 h-5" />
                <span className="font-semibold text-sm">Não concordo</span>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                  <MessageSquare className="w-4 h-4" />
                  Motivo da contestação
                </div>
                <Textarea
                  placeholder="Descreva por que contesta essa divergência. Ex: a área já foi embargada e está em processo de recomposição conforme laudo técnico..."
                  value={justificativa}
                  onChange={(e) => setJustificativa(e.target.value)}
                  rows={5}
                  className="text-sm resize-none"
                />
                <p className="text-xs text-muted-foreground">
                  Mínimo recomendado: 30 caracteres ({justificativa.length}/30)
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEtapa("selecao")}
                  className="flex-1"
                >
                  Voltar
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={justificativa.trim().length < 10}
                  onClick={() => setEtapa("concluido")}
                  className="flex-1"
                >
                  Registrar contestação
                </Button>
              </div>
            </div>
          )}

          {etapa === "concluido" && (
            <div className="space-y-4 text-center">
              <div className="w-14 h-14 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="font-bold text-foreground">Contestação registrada</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Sua justificativa foi anotada para análise.
                </p>
              </div>
              <Button className="w-full" onClick={() => navigate({ to: "/" })}>
                Voltar ao painel
              </Button>
            </div>
          )}
        </div>

        {/* Multiple divergências indicator */}
        {diagnostico && diagnostico.divergencias.length > 1 && (
          <div className="p-4 border-t border-border bg-muted/30">
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" />
              {diagnostico.divergencias.length} divergências encontradas neste imóvel.
            </p>
          </div>
        )}

        {/* Painel: Notificar Agricultor */}
        {imovel?.numeroCAR && (
          <div className="border-t border-border p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-primary" />
              <span className="text-sm font-bold text-foreground">Notificar Agricultor</span>
            </div>

            {notifEnviada ? (
              <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-3 text-center space-y-2">
                <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto" />
                <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Notificação enviada!</p>
                <button
                  className="text-xs text-emerald-600 underline"
                  onClick={() => setNotifEnviada(false)}
                >
                  Enviar outra
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <select
                    value={notifTipo}
                    onChange={(e) => setNotifTipo(e.target.value)}
                    className="flex-1 text-xs rounded-lg border border-border bg-background px-2 py-1.5 text-foreground"
                  >
                    <option value="pendencia">⚠️ Pendência</option>
                    <option value="reprovado">❌ Correção necessária</option>
                    <option value="aprovado">✅ Aprovado</option>
                    <option value="info">ℹ️ Informação</option>
                  </select>
                  <select
                    value={notifPrioridade}
                    onChange={(e) => setNotifPrioridade(e.target.value)}
                    className="text-xs rounded-lg border border-border bg-background px-2 py-1.5 text-foreground"
                  >
                    <option value="baixa">Baixa</option>
                    <option value="media">Média</option>
                    <option value="alta">🔴 Alta</option>
                  </select>
                </div>

                <Textarea
                  placeholder="Escreva a mensagem para o agricultor..."
                  value={notifMensagem}
                  onChange={(e) => setNotifMensagem(e.target.value)}
                  rows={3}
                  className="text-sm resize-none"
                />

                <Button
                  size="sm"
                  className="w-full gap-1.5"
                  disabled={!notifMensagem.trim() || enviarNotificacao.isPending}
                  onClick={() => enviarNotificacao.mutate(imovel.numeroCAR!)}
                >
                  {enviarNotificacao.isPending
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <Send className="w-3.5 h-3.5" />
                  }
                  Enviar ao agricultor
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right: satellite map showing divergência */}
      <div className="flex-1 relative overflow-hidden bg-muted/20">
        {mapGeometry && CarPreviewMap ? (
          <Suspense
            fallback={
              <div className="w-full h-full flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            }
          >
            <CarPreviewMap geometry={mapGeometry} />
          </Suspense>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
            Mapa indisponível
          </div>
        )}

        {/* Overlay label */}
        {mapGeometry && (
          <div className="absolute bottom-4 left-4 bg-black/60 text-white text-xs px-3 py-1.5 rounded-full backdrop-blur-sm">
            Área em divergência destacada no mapa
          </div>
        )}
      </div>
    </div>
  );
}
