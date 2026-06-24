import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { 
  ArrowLeft, FileText, CheckCircle2, ShieldAlert, Send, 
  MessageSquare, History, Loader2, AlertTriangle, Eye
} from "lucide-react";
import { getImovel, getDiagnostico } from "@/api";
import type { Imovel, Diagnostico } from "@/types/imovel";
import { appStore } from "@/lib/app-store";

export const Route = createFileRoute("/retificacao")({
  validateSearch: z.object({
    imovelId: z.string().optional(),
  }),
  component: RetificacaoScreen,
});

function RetificacaoScreen() {
  const { imovelId } = Route.useSearch();
  const navigate = useNavigate();

  const [imovel, setImovel] = useState<Imovel | null>(null);
  const [diagnostico, setDiagnostico] = useState<Diagnostico | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [parecer, setParecer] = useState("");
  const [acao, setAcao] = useState<"aprovar" | "retificar" | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function loadData() {
      if (!imovelId) {
        navigate({ to: "/" });
        return;
      }
      try {
        setLoading(true);
        const [im, diag] = await Promise.all([
          getImovel(imovelId),
          getDiagnostico(imovelId)
        ]);
        if (!im) throw new Error("Not found");
        setImovel(im);
        setDiagnostico(diag);
        
        // Auto-fill parecer
        if (diag && diag.divergencias.length > 0) {
          const autoText = `Análise do imóvel ${im.numeroCAR} concluída.\n\nForam encontradas ${diag.divergencias.length} divergências:\n${diag.divergencias.map(d => `- ${d.tipo}`).join('\n')}\n\nSolicita-se a notificação do proprietário para retificação do CAR de acordo com o PRADA aplicável.`;
          setParecer(autoText);
          setAcao("retificar");
        } else {
          setParecer(`Análise do imóvel ${im.numeroCAR} concluída.\n\nNão foram encontradas divergências significativas de supressão ou avanço em áreas protegidas. O traçado declarado condiz com a cobertura observada via satélite.`);
          setAcao("aprovar");
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [imovelId, navigate]);

  const handleSubmit = async () => {
    if (!acao || !imovel) return;
    setIsSubmitting(true);
    // Simula salvamento no backoffice
    await new Promise(r => setTimeout(r, 1500));
    
    // Adiciona log de atividade
    appStore.addLog({
      imovelId: imovel.id,
      imovelNome: imovel.nome,
      acao: acao === "aprovar" ? "Validado" : "Retificação Solicitada",
      detalhes: parecer
    });
    
    setIsSubmitting(false);
    navigate({ to: "/" });
  };

  if (loading || !imovel || !diagnostico) {
    return (
      <div className="flex-1 flex items-center justify-center bg-muted/30">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center py-8 px-4 overflow-y-auto bg-muted/30">
      <div className="w-full max-w-4xl space-y-6">
        
        <button 
          onClick={() => navigate({ to: "/diagnostico", search: { imovelId: imovel.id } })}
          className="flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar para o Diagnóstico
        </button>

        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Ação e Parecer</h1>
            <p className="text-muted-foreground mt-1">Elabore o laudo técnico para o imóvel {imovel.nome}</p>
          </div>
          <span className="px-3 py-1 bg-card border border-border rounded-lg text-sm font-bold text-muted-foreground">
            {imovel.numeroCAR}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* Painel Principal */}
          <div className="col-span-2 space-y-6">
            
            {/* Editor do Parecer */}
            <div className="bg-card border border-border rounded-2xl shadow-soft p-6 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <FileText className="w-4 h-4" /> Parecer Técnico
                </h3>
                <button className="text-xs text-primary font-bold hover:underline">
                  Carregar Template
                </button>
              </div>
              
              <textarea
                value={parecer}
                onChange={e => setParecer(e.target.value)}
                rows={8}
                className="w-full p-4 bg-muted/50 border border-border rounded-xl text-sm leading-relaxed focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 resize-none transition-all"
                placeholder="Descreva as conclusões da análise técnica..."
              />
            </div>

            {/* Ação Decisória */}
            <div className="bg-card border border-border rounded-2xl shadow-soft p-6">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">Decisão</h3>
              <div className="flex gap-4">
                <button
                  onClick={() => setAcao("aprovar")}
                  className={`flex-1 flex flex-col items-center justify-center p-4 border-2 rounded-xl transition-all ${
                    acao === "aprovar" 
                      ? "border-primary bg-primary/5 text-primary" 
                      : "border-border text-muted-foreground hover:border-primary/50"
                  }`}
                >
                  <CheckCircle2 className={`w-8 h-8 mb-2 ${acao === "aprovar" ? "text-primary" : "text-muted-foreground"}`} />
                  <span className="font-bold">Validar Imóvel</span>
                  <span className="text-xs mt-1 text-center opacity-80">Sem divergências ou resolvidas</span>
                </button>

                <button
                  onClick={() => setAcao("retificar")}
                  className={`flex-1 flex flex-col items-center justify-center p-4 border-2 rounded-xl transition-all ${
                    acao === "retificar" 
                      ? "border-amber-warn bg-amber-warn/5 text-amber-warn" 
                      : "border-border text-muted-foreground hover:border-amber-warn/50"
                  }`}
                >
                  <ShieldAlert className={`w-8 h-8 mb-2 ${acao === "retificar" ? "text-amber-warn" : "text-muted-foreground"}`} />
                  <span className="font-bold">Marcar para Retificação</span>
                  <span className="text-xs mt-1 text-center opacity-80">Notificar produtor</span>
                </button>
              </div>

              <div className="mt-6 flex justify-end">
                <button 
                  disabled={!acao || isSubmitting}
                  onClick={handleSubmit}
                  className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground font-bold rounded-xl shadow-premium hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Send className="w-5 h-5" /> Enviar Parecer
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="col-span-1 space-y-6">
            
            {/* Resumo das Divergências */}
            <div className="bg-card border border-border rounded-2xl shadow-soft p-5">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" /> Resumo
              </h3>
              
              {diagnostico.divergencias.length > 0 ? (
                <div className="space-y-3">
                  {diagnostico.divergencias.map(div => (
                    <div key={div.id} className="p-3 bg-destructive/5 border border-destructive/20 rounded-lg">
                      <h4 className="font-bold text-xs text-foreground mb-1">{div.tipo}</h4>
                      <p className="text-[11px] text-muted-foreground line-clamp-2">{div.caminhoRetificacao}</p>
                    </div>
                  ))}
                  <button 
                    onClick={() => navigate({ to: "/diagnostico", search: { imovelId: imovel.id } })}
                    className="w-full mt-2 text-xs font-bold text-primary flex items-center justify-center gap-1 hover:underline"
                  >
                    <Eye className="w-3 h-3" /> Ver no mapa
                  </button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground font-semibold text-center py-4">
                  Nenhuma divergência detectada no laudo automático.
                </p>
              )}
            </div>

            {/* Histórico */}
            <div className="bg-card border border-border rounded-2xl shadow-soft p-5">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
                <History className="w-4 h-4" /> Histórico
              </h3>
              <div className="space-y-4 relative before:absolute before:inset-0 before:ml-2 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
                <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                  <div className="flex items-center justify-center w-4 h-4 rounded-full border-2 border-primary bg-card text-slate-500 group-[.is-active]:text-emerald-50 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 ml-0" />
                  <div className="w-[calc(100%-2rem)] md:w-[calc(50%-1.5rem)] bg-card border border-border p-3 rounded-xl shadow-sm ml-4 md:ml-0">
                    <div className="flex items-center justify-between space-x-2 mb-1">
                      <div className="font-bold text-foreground text-xs">Análise Inicial</div>
                      <div className="text-[10px] text-muted-foreground">Ontem</div>
                    </div>
                    <div className="text-xs text-muted-foreground">Sistema Tupã identificou {diagnostico.divergencias.length} divergências.</div>
                  </div>
                </div>
                
                <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
                  <div className="flex items-center justify-center w-4 h-4 rounded-full border-2 border-muted bg-muted shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 ml-0" />
                  <div className="w-[calc(100%-2rem)] md:w-[calc(50%-1.5rem)] bg-muted/30 border border-border p-3 rounded-xl shadow-sm ml-4 md:ml-0">
                    <div className="flex items-center justify-between space-x-2 mb-1">
                      <div className="font-bold text-foreground text-xs opacity-70">Recepção CAR</div>
                      <div className="text-[10px] text-muted-foreground">15 Mai</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
          </div>
        </div>
      </div>
    </div>
  );
}
