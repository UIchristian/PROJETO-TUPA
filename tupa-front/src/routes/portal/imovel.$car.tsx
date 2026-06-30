import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import {
  Download,
  ArrowLeft,
  Info,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  MapPin,
  Droplets,
  Scale,
  Satellite,
  TreePine,
  Clock,
  Plus,
  Trash2,
  Bell,
  BellRing,
  X,
} from "lucide-react";

import { getBaseReferencia } from "@/api";
import type { TipoFeicao, NivelConfianca } from "@/types/imovel";
import BaseReferenciaMap from "@/components/BaseReferenciaMap";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

type Notificacao = {
  id: number;
  mensagem: string;
  tipo: string;
  prioridade: string;
  analista_nome: string;
  status: string;
  criado_em: string;
};

const STEPS = [
  { icon: MapPin,    label: "Localizando sua propriedade no mapa...",      est: "~5 s" },
  { icon: Satellite, label: "Consultando imagens de satélite Sentinel-2...", est: "~10–30 s" },
  { icon: Droplets,  label: "Mapeando rios, nascentes e encostas...",       est: "~30–90 s" },
  { icon: Scale,     label: "Aplicando o Código Florestal...",              est: "~10–20 s" },
  { icon: TreePine,  label: "Preparando seu resultado...",                   est: "~5 s" },
];

export const Route = createFileRoute("/portal/imovel/$car")({
  component: ImovelPortalView,
});

const DEMO_NOTIF: Notificacao[] = [
  {
    id: 1,
    mensagem:
      "Identificamos irregularidades na sua propriedade. Foi detectada supressão de vegetação nativa dentro da faixa de APP (Área de Preservação Permanente) ao longo do curso d'água. Por favor, acesse a seção de retificação e solicite a correção do seu CAR.",
    tipo: "pendencia",
    prioridade: "alta",
    analista_nome: "Luana S.",
    status: "nova",
    criado_em: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
  },
  {
    id: 2,
    mensagem:
      "Verificamos também que a área declarada de Reserva Legal está abaixo do mínimo exigido pelo Código Florestal para imóveis no bioma Cerrado (20%). Será necessário incluir a área complementar na retificação.",
    tipo: "pendencia",
    prioridade: "media",
    analista_nome: "Luana S.",
    status: "nova",
    criado_em: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
  },
];

type Phase = "processing" | "done" | "error";

const TIPOS_VISIVEIS = new Set<TipoFeicao>([
  "APP_CURSO_DAGUA",
  "APP_NASCENTE",
  "APP_LAGO",
  "APP_VEREDA",
  "USO_RESTRITO_ENCOSTA",
  "RESERVA_LEGAL_PROPOSTA",
  "COBERTURA",
]);
const CONFIANCAS_VISIVEIS = new Set<NivelConfianca>(["alta", "media", "baixa"]);

function ImovelPortalView() {
  const { car } = Route.useParams();

  const [phase, setPhase] = useState<Phase>("processing");
  const [municipio, setMunicipio] = useState("");
  const [nomeImovel, setNomeImovel] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const animRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [elapsedSecs, setElapsedSecs] = useState(0);
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [retificacaoEnviada, setRetificacaoEnviada] = useState(false);
  const [motivos, setMotivos] = useState([{ tipo: "", observacao: "" }]);
  const [protocolo, setProtocolo] = useState<string | null>(null);

  const addMotivo = () => setMotivos((m) => [...m, { tipo: "", observacao: "" }]);
  const removeMotivo = (i: number) => setMotivos((m) => m.filter((_, idx) => idx !== i));
  const updateMotivo = (i: number, field: "tipo" | "observacao", val: string) =>
    setMotivos((m) => m.map((item, idx) => (idx === i ? { ...item, [field]: val } : item)));

  function fmtElapsed(s: number) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}:${String(sec).padStart(2, "0")} min` : `${sec} s`;
  }

  useEffect(() => {
    let cancelled = false;
    setPhase("processing");
    setProgress(0);
    setCurrentStep(0);
    setElapsedSecs(0);

    // Elapsed timer
    elapsedRef.current = setInterval(() => setElapsedSecs((s) => s + 1), 1000);

    // Phase 1: 0→85% in ~10s | Phase 2: crawl
    const PHASE1_TARGET = 85;
    const phase1Step = PHASE1_TARGET / (10000 / 80);
    animRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 99) return 99;
        const step = prev < PHASE1_TARGET ? phase1Step : 0.02;
        const next = Math.min(99, prev + step);
        setCurrentStep(Math.min(Math.floor((next / 100) * STEPS.length), STEPS.length - 1));
        return next;
      });
    }, 80);

    // Primeiro tenta encontrar o imóvel já processado na lista
    const finish = (municipioNome: string) => {
      if (cancelled) return;
      clearInterval(animRef.current!);
      clearInterval(elapsedRef.current!);
      setProgress(100);
      setCurrentStep(STEPS.length);
      setMunicipio(municipioNome);
      setNomeImovel(municipioNome);
      setTimeout(() => { if (!cancelled) setPhase("done"); }, 600);
    };

    fetch(`${BASE_URL}/imoveis`)
      .then((r) => r.json())
      .then((lista: { numero_car: string; municipio: string }[]) => {
        if (cancelled) return;
        const encontrado = lista.find(
          (i) => i.numero_car === car || i.numero_car === decodeURIComponent(car),
        );
        if (encontrado?.municipio) {
          finish(encontrado.municipio);
        } else {
          // CAR ainda não processado — dispara processamento
          fetch(`${BASE_URL}/imovel/processar/${encodeURIComponent(car)}`, { method: "POST" })
            .then((res) => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); })
            .then(() => fetch(`${BASE_URL}/imoveis`))
            .then((r) => r.json())
            .then((lista2: { numero_car: string; municipio: string }[]) => {
              const i2 = lista2.find((i) => i.numero_car === car);
              finish(i2?.municipio ?? "");
            })
            .catch(() => finish(""));
        }
      })
      .catch(() => {
        // Backend offline — modo demo
        finish("Patrocinio");
      });

    return () => {
      cancelled = true;
      if (animRef.current) clearInterval(animRef.current);
      if (elapsedRef.current) clearInterval(elapsedRef.current);
    };
  }, [car]);

  const { data: base, isLoading: loadingBase } = useQuery({
    queryKey: ["portal", "base", municipio],
    queryFn: () => getBaseReferencia(municipio),
    enabled: phase === "done" && !!municipio,
  });

  const { data: notificacoes = DEMO_NOTIF, refetch: refetchNotif } = useQuery({
    queryKey: ["portal", "notificacoes", car],
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}/notificacao/${encodeURIComponent(car)}`);
      if (!res.ok) return DEMO_NOTIF;
      const data: Notificacao[] = await res.json();
      return data.length > 0 ? data : DEMO_NOTIF;
    },
    enabled: phase === "done",
    refetchInterval: 30_000,
    initialData: DEMO_NOTIF,
  });

  const notifNovas = notificacoes.filter((n) => n.status === "nova");

  const marcarVisualizada = async (id: number) => {
    await fetch(`${BASE_URL}/notificacao/${id}/visualizar`, { method: "PATCH" });
    refetchNotif();
  };

  const imovelId = `imovel_${car}`;
  const feicoes = base?.feicoes.filter((f) => !f.imovelId || f.imovelId === imovelId) ?? [];
  const limites  = base?.limites.filter((l) => l.numeroCar === car) ?? [];

  let areaPreservacao = 0;
  let areaReserva = 0;
  let temBaixaConfianca = false;
  feicoes.forEach((f) => {
    if (f.tipo.startsWith("APP_")) areaPreservacao += f.areaHectares;
    if (f.tipo === "RESERVA_LEGAL_PROPOSTA") areaReserva += f.areaHectares;
    if (f.confianca === "baixa") temBaixaConfianca = true;
  });

  const handleEnviarRetificacao = (e: React.FormEvent) => {
    e.preventDefault();
    const num = `2026.${Math.floor(Math.random() * 1_000_000).toString().padStart(6, "0")}`;
    setProtocolo(num);
    try {
      const saved = JSON.parse(localStorage.getItem("tupa_retificacoes") || "[]");
      saved.push({ car, motivos, protocolo: num, data: new Date().toISOString() });
      localStorage.setItem("tupa_retificacoes", JSON.stringify(saved));
    } catch {}
    setRetificacaoEnviada(true);
  };

  // ── PROCESSING ──────────────────────────────────────────────────────────────
  if (phase === "processing") {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[70vh] px-6 py-12">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center space-y-3">
            <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center mx-auto">
              <Loader2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400 animate-spin" />
            </div>
            <h2 className="text-xl font-bold text-foreground">Analisando sua propriedade</h2>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">
              Estamos consultando dados de satélite e cruzando com as regras ambientais. Aguarde um momento.
            </p>
          </div>

          {/* Tempo decorrido + estimativa */}
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Clock className="w-3.5 h-3.5" />
              <span>Tempo: <span className="font-mono font-semibold text-foreground">{fmtElapsed(elapsedSecs)}</span></span>
            </div>
            <span className="text-xs text-muted-foreground">
              {currentStep < STEPS.length ? `Est. ${STEPS[currentStep].est}` : "Concluindo..."}
            </span>
          </div>

          <Progress value={progress} className="h-2.5 [&>div]:bg-emerald-500" />

          <div className="space-y-3">
            {STEPS.map((step, i) => {
              const done   = i < currentStep;
              const active = i === currentStep && phase === "processing";
              const Icon   = step.icon;
              return (
                <div
                  key={i}
                  className={`flex items-center justify-between gap-3 text-sm transition-all duration-300 ${
                    done   ? "text-emerald-600 dark:text-emerald-400"
                    : active ? "text-foreground font-medium"
                    : "text-muted-foreground/40"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {done ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                    ) : (
                      <div
                        className={`w-4 h-4 rounded-full border-2 shrink-0 transition-all ${
                          active ? "border-emerald-500 scale-110" : "border-muted-foreground/30"
                        }`}
                      />
                    )}
                    {step.label}
                  </div>
                  {active && (
                    <span className="text-xs text-muted-foreground shrink-0">{step.est}</span>
                  )}
                </div>
              );
            })}
          </div>

          {elapsedSecs >= 30 && (
            <p className="text-xs text-amber-600 dark:text-amber-400 text-center bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-2">
              O mapeamento de rios é mais lento na 1ª consulta por município.<br />
              Próximas vezes o sistema usa o cache — muito mais rápido.
            </p>
          )}
          {elapsedSecs < 30 && (
            <p className="text-xs text-muted-foreground text-center">
              Tempo total estimado: 30 s a 2 min (1ª consulta)
            </p>
          )}
        </div>
      </div>
    );
  }

  // ── ERROR ────────────────────────────────────────────────────────────────────
  if (phase === "error") {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-4">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />
          <h2 className="text-xl font-bold text-foreground">Não foi possível processar</h2>
          <p className="text-sm text-muted-foreground">
            Verifique se o número do CAR está correto e tente novamente.
          </p>
          {errorMsg && (
            <p className="text-xs text-muted-foreground/60 font-mono break-all">{errorMsg}</p>
          )}
          <Button asChild>
            <Link to="/portal">Voltar para a busca</Link>
          </Button>
        </div>
      </div>
    );
  }

  // ── DONE ─────────────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 w-full bg-muted/20">
      <div className="max-w-5xl mx-auto px-4 py-6 md:py-8 space-y-6">

        {/* Banner de notificações do analista */}
        {notificacoes.length > 0 && (
          <div className="space-y-2">
            {notificacoes.map((n) => {
              const isNova = n.status === "nova";
              const cores: Record<string, string> = {
                aprovado:   "border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-800",
                reprovado:  "border-red-300 bg-red-50 dark:bg-red-900/20 dark:border-red-800",
                pendencia:  "border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800",
                info:       "border-blue-300 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800",
              };
              const iconeCor: Record<string, string> = {
                aprovado: "text-emerald-600 dark:text-emerald-400",
                reprovado: "text-red-600 dark:text-red-400",
                pendencia: "text-amber-600 dark:text-amber-400",
                info: "text-blue-600 dark:text-blue-400",
              };
              const label: Record<string, string> = {
                aprovado: "CAR Aprovado",
                reprovado: "Correção Necessária",
                pendencia: "Pendência Identificada",
                info: "Informação do Analista",
              };
              return (
                <div
                  key={n.id}
                  className={`rounded-2xl border p-4 flex items-start gap-4 ${cores[n.tipo] ?? cores.info} ${isNova ? "ring-2 ring-offset-1 ring-amber-400/60" : "opacity-80"}`}
                >
                  <div className="shrink-0 mt-0.5">
                    {isNova
                      ? <BellRing className={`w-5 h-5 ${iconeCor[n.tipo] ?? iconeCor.info}`} />
                      : <Bell className={`w-5 h-5 ${iconeCor[n.tipo] ?? iconeCor.info}`} />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`text-sm font-bold ${iconeCor[n.tipo] ?? iconeCor.info}`}>
                        {label[n.tipo] ?? "Notificação"}
                      </span>
                      {isNova && (
                        <span className="text-[10px] font-bold bg-amber-400 text-amber-900 px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                          Nova
                        </span>
                      )}
                      {n.prioridade === "alta" && (
                        <span className="text-[10px] font-bold bg-red-500 text-white px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                          Urgente
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-foreground">{n.mensagem}</p>
                    <p className="text-xs text-muted-foreground mt-1.5">
                      Analista: <span className="font-medium">{n.analista_nome}</span>
                      {" · "}
                      {new Date(n.criado_em).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                    </p>
                  </div>
                  {isNova && (
                    <button
                      onClick={() => marcarVisualizada(n.id)}
                      title="Marcar como lida"
                      className="shrink-0 text-muted-foreground hover:text-foreground transition-colors mt-0.5"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Cabeçalho */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild className="rounded-full shrink-0">
              <Link to="/portal">
                <ArrowLeft className="w-5 h-5" />
              </Link>
            </Button>
            <div>
              <h1 className="text-xl font-bold text-foreground">
                {nomeImovel} — MG
              </h1>
              <p className="text-xs text-muted-foreground font-mono mt-0.5 break-all">{car}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {notifNovas.length > 0 && (
              <span className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-3 py-1.5 rounded-full font-semibold border border-amber-300 dark:border-amber-700 animate-pulse">
                <BellRing className="w-3.5 h-3.5" />
                {notifNovas.length} nova{notifNovas.length > 1 ? "s" : ""} notificação{notifNovas.length > 1 ? "ões" : ""}
              </span>
            )}
            <span className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1.5 rounded-full font-semibold border border-emerald-200 dark:border-emerald-800">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Análise concluída
            </span>
          </div>
        </div>

        {/* Mapa */}
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="h-[50vh] md:h-[60vh] relative">
            {loadingBase ? (
              <div className="w-full h-full flex items-center justify-center bg-muted/30">
                <Loader2 className="w-7 h-7 animate-spin text-muted-foreground" />
              </div>
            ) : base ? (
              <BaseReferenciaMap
                limites={limites.length > 0 ? limites : (base.limites ?? [])}
                feicoes={feicoes.length > 0 ? feicoes : (base.feicoes ?? [])}
                tiposVisiveis={TIPOS_VISIVEIS}
                confiancasVisiveis={CONFIANCAS_VISIVEIS}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-muted/30 text-muted-foreground text-sm">
                Mapa indisponível
              </div>
            )}

          </div>
        </div>

        {/* Cartões de resumo */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
          <div className="bg-card rounded-2xl border border-border p-4 shadow-sm">
            <p className="text-xs text-muted-foreground font-medium">Município</p>
            <p className="text-lg font-bold text-foreground mt-0.5">{nomeImovel}</p>
          </div>

          <div className="bg-cyan-50 dark:bg-cyan-900/20 rounded-2xl border border-cyan-200 dark:border-cyan-900/40 p-4 shadow-sm">
            <p className="text-xs text-cyan-700 dark:text-cyan-400 font-medium">Áreas de preservação</p>
            <p className="text-2xl font-bold text-cyan-800 dark:text-cyan-300 mt-0.5">
              {areaPreservacao > 0 ? `${areaPreservacao.toFixed(1)} ha` : "—"}
            </p>
            <p className="text-[10px] text-cyan-600 dark:text-cyan-500 mt-0.5">Ao longo de rios e nascentes</p>
          </div>

          <div className="bg-green-50 dark:bg-green-900/20 rounded-2xl border border-green-200 dark:border-green-900/40 p-4 shadow-sm">
            <p className="text-xs text-green-700 dark:text-green-400 font-medium">Reserva Legal</p>
            <p className="text-2xl font-bold text-green-800 dark:text-green-300 mt-0.5">
              {areaReserva > 0 ? `${areaReserva.toFixed(1)} ha` : "—"}
            </p>
            <p className="text-[10px] text-green-600 dark:text-green-500 mt-0.5">Área que deve manter vegetação</p>
          </div>
        </div>

        {/* Aviso de confiança */}
        {temBaixaConfianca && (
          <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/40 rounded-2xl p-4">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-400">Algumas áreas precisam de verificação</p>
              <p className="text-xs text-amber-700 dark:text-amber-500 mt-0.5">
                Detectamos pontos com baixa confiança — pode ser vegetação densa ou nuvens nas imagens. Um analista pode conferir.
              </p>
            </div>
          </div>
        )}

        {/* Retificação */}
        <div className="bg-card rounded-2xl border border-border p-6 md:p-8 shadow-sm">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Info className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">As informações batem com a sua propriedade?</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Se algo estiver diferente da realidade — um rio que secou, uma encosta que não existe — você pode solicitar uma correção.
                Um analista irá avaliar o seu pedido.
              </p>
            </div>
          </div>

          {retificacaoEnviada ? (
            <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-900/30 rounded-xl p-6 text-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
              <h3 className="font-bold text-emerald-800 dark:text-emerald-400 text-lg">Solicitação enviada!</h3>
              {protocolo && (
                <p className="text-emerald-700 dark:text-emerald-500 font-bold mt-2 text-lg">
                  Protocolo: {protocolo}
                </p>
              )}
              <p className="text-sm text-emerald-700 dark:text-emerald-500 mt-2 max-w-md mx-auto">
                Guarde o número do protocolo. Nossos analistas irão verificar as imagens de satélite e responder.
              </p>
              <Button
                variant="outline"
                className="mt-5 border-emerald-200 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:text-emerald-400"
                onClick={() => setRetificacaoEnviada(false)}
              >
                Enviar nova correção
              </Button>
            </div>
          ) : (
            <form onSubmit={handleEnviarRetificacao} className="space-y-4 max-w-2xl">
              <div className="space-y-3">
                {motivos.map((motivo, i) => (
                  <div key={i} className="rounded-xl border border-border bg-muted/30 p-4 space-y-3 relative">
                    {motivos.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeMotivo(i)}
                        className="absolute top-3 right-3 text-muted-foreground hover:text-destructive transition-colors"
                        title="Remover motivo"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    <div className="space-y-1.5">
                      <Label htmlFor={`tipo-${i}`}>
                        {motivos.length > 1 ? `Motivo ${i + 1} — O que está diferente?` : "O que está diferente?"}
                      </Label>
                      <Select value={motivo.tipo} onValueChange={(v) => updateMotivo(i, "tipo", v)} required>
                        <SelectTrigger id={`tipo-${i}`}>
                          <SelectValue placeholder="Selecione a área com diferença" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="APP">Áreas de preservação (rios e nascentes)</SelectItem>
                          <SelectItem value="RESERVA_LEGAL">Reserva Legal</SelectItem>
                          <SelectItem value="USO_RESTRITO">Áreas de uso restrito (encostas)</SelectItem>
                          <SelectItem value="VEGETACAO_NATIVA">Vegetação nativa mapeada incorretamente</SelectItem>
                          <SelectItem value="AREA_ANTROPIZADA">Área agropecuária / antropizada</SelectItem>
                          <SelectItem value="APP_CONSOLIDADA">APP consolidada (uso anterior a 2008)</SelectItem>
                          <SelectItem value="CORPO_DAGUA">Lagos, represas ou corpos d'água</SelectItem>
                          <SelectItem value="LIMITE_IMOVEL">Limite do imóvel (polígono do CAR)</SelectItem>
                          <SelectItem value="COBERTURA">Cobertura da terra em geral</SelectItem>
                          <SelectItem value="OUTRO">Outro assunto</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`obs-${i}`}>Detalhe (opcional)</Label>
                      <Textarea
                        id={`obs-${i}`}
                        placeholder="Ex: O rio marcado no mapa já não existe há muitos anos..."
                        value={motivo.observacao}
                        onChange={(e) => updateMotivo(i, "observacao", e.target.value)}
                        className="min-h-[80px] resize-none"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={addMotivo}
                className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400 hover:text-emerald-900 dark:hover:text-emerald-300 font-medium transition-colors"
              >
                <Plus className="w-4 h-4" />
                Adicionar outro motivo
              </button>

              <Button type="submit" className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700">
                Solicitar Correção
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
