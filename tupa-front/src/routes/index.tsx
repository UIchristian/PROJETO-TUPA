import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Search, ShieldAlert, CheckCircle2, ChevronRight, AlertTriangle, FileText, History } from "lucide-react";
import { getImoveis, getDiagnostico } from "@/api";
import type { Imovel, Diagnostico } from "@/types/imovel";
import { useAppState } from "@/lib/app-store";

export const Route = createFileRoute("/")({
  component: FilaScreen,
});

interface FilaItem extends Imovel {
  diagnostico?: Diagnostico;
  isLoading: boolean;
  status: "Pendente" | "Validado" | "Retificar";
}

function FilaScreen() {
  const { logs } = useAppState();
  const [activeTab, setActiveTab] = useState<"fila" | "logs">("fila");

  const [fila, setFila] = useState<FilaItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [filterUf, setFilterUf] = useState("");
  const [filterScore, setFilterScore] = useState("");
  const [filterSeveridade, setFilterSeveridade] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const imoveis = await getImoveis();
        
        // Match with local logs to determine status
        const initialFila: FilaItem[] = imoveis.map(im => {
          const log = logs.find(l => l.imovelId === im.id);
          let status: FilaItem["status"] = "Pendente";
          if (log) {
            status = log.acao === "Validado" ? "Validado" : "Retificar";
          }
          return { ...im, isLoading: true, status };
        });
        
        setFila(initialFila);

        imoveis.forEach(async (im) => {
          try {
            const diag = await getDiagnostico(im.id);
            setFila(prev => prev.map(p => p.id === im.id ? { ...p, diagnostico: diag || undefined, isLoading: false } : p));
          } catch (e) {
            setFila(prev => prev.map(p => p.id === im.id ? { ...p, isLoading: false } : p));
          }
        });

      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [logs]);

  const filteredFila = fila
    .filter(item => {
      // Texto (Nome ou CAR)
      if (searchTerm && !item.nome.toLowerCase().includes(searchTerm.toLowerCase()) && !item.numeroCAR.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      // UF
      if (filterUf && item.uf !== filterUf) return false;
      // Status
      if (filterStatus && item.status !== filterStatus) return false;
      
      const score = item.diagnostico?.scoreConformidade ?? 100;
      // Faixa de Score
      if (filterScore === "critico" && score >= 70) return false;
      if (filterScore === "atencao" && (score < 70 || score >= 90)) return false;
      if (filterScore === "regular" && score < 90) return false;

      // Severidade
      if (filterSeveridade) {
        const hasSev = item.diagnostico?.divergencias?.some(d => d.severidade.toLowerCase() === filterSeveridade.toLowerCase());
        if (!hasSev && filterSeveridade !== "Nenhuma") return false;
        if (filterSeveridade === "Nenhuma" && item.diagnostico?.divergencias && item.diagnostico.divergencias.length > 0) return false;
      }

      return true;
    })
    .sort((a, b) => {
      const scoreA = a.diagnostico?.scoreConformidade ?? 100;
      const scoreB = b.diagnostico?.scoreConformidade ?? 100;
      return scoreA - scoreB;
    });

  return (
    <div className="flex-1 flex flex-col p-8 bg-muted/30">
      <div className="max-w-7xl w-full mx-auto space-y-6">
        
        <div className="flex justify-between items-end border-b border-border pb-4">
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight text-foreground">Painel de Auditoria</h2>
            <p className="text-muted-foreground mt-1">Gerencie as inspeções e o histórico do CAR.</p>
          </div>
          
          <div className="flex gap-2 p-1 bg-card border border-border rounded-xl">
            <button 
              onClick={() => setActiveTab("fila")}
              className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === "fila" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:bg-muted"}`}
            >
              Fila de Análise
            </button>
            <button 
              onClick={() => setActiveTab("logs")}
              className={`px-6 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === "logs" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:bg-muted"}`}
            >
              <History className="w-4 h-4" /> Histórico ({logs.length})
            </button>
          </div>
        </div>

        {activeTab === "fila" && (
          <div className="space-y-4">
            {/* Barra de Filtros Completa */}
            <div className="bg-card border border-border rounded-2xl shadow-soft p-4 flex flex-wrap gap-4 items-center">
              <div className="relative flex-1 min-w-[250px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input 
                  type="text" 
                  placeholder="Buscar por CAR ou nome..." 
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pl-9 pr-4 py-2.5 w-full rounded-xl border border-border bg-background text-sm font-medium focus:outline-none focus:border-primary"
                />
              </div>
              
              <select value={filterUf} onChange={e => setFilterUf(e.target.value)} className="py-2.5 px-3 rounded-xl border border-border bg-background text-sm font-medium focus:outline-none focus:border-primary">
                <option value="">Todos os Estados</option>
                <option value="AC">Acre</option>
                <option value="AL">Alagoas</option>
                <option value="AP">Amapá</option>
                <option value="AM">Amazonas</option>
                <option value="BA">Bahia</option>
                <option value="CE">Ceará</option>
                <option value="DF">Distrito Federal</option>
                <option value="ES">Espírito Santo</option>
                <option value="GO">Goiás</option>
                <option value="MA">Maranhão</option>
                <option value="MT">Mato Grosso</option>
                <option value="MS">Mato Grosso do Sul</option>
                <option value="MG">Minas Gerais</option>
                <option value="PA">Pará</option>
                <option value="PB">Paraíba</option>
                <option value="PR">Paraná</option>
                <option value="PE">Pernambuco</option>
                <option value="PI">Piauí</option>
                <option value="RJ">Rio de Janeiro</option>
                <option value="RN">Rio Grande do Norte</option>
                <option value="RS">Rio Grande do Sul</option>
                <option value="RO">Rondônia</option>
                <option value="RR">Roraima</option>
                <option value="SC">Santa Catarina</option>
                <option value="SP">São Paulo</option>
                <option value="SE">Sergipe</option>
                <option value="TO">Tocantins</option>
              </select>

              <select value={filterScore} onChange={e => setFilterScore(e.target.value)} className="py-2.5 px-3 rounded-xl border border-border bg-background text-sm font-medium focus:outline-none focus:border-primary">
                <option value="">Qualquer Score</option>
                <option value="critico">Crítico (0 - 69)</option>
                <option value="atencao">Atenção (70 - 89)</option>
                <option value="regular">Regular (90 - 100)</option>
              </select>

              <select value={filterSeveridade} onChange={e => setFilterSeveridade(e.target.value)} className="py-2.5 px-3 rounded-xl border border-border bg-background text-sm font-medium focus:outline-none focus:border-primary">
                <option value="">Qualquer Severidade</option>
                <option value="ALTA">Alta</option>
                <option value="MÉDIA">Média</option>
                <option value="BAIXA">Baixa</option>
                <option value="Nenhuma">Sem Divergência</option>
              </select>

              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="py-2.5 px-3 rounded-xl border border-border bg-background text-sm font-medium focus:outline-none focus:border-primary">
                <option value="">Todos os Status</option>
                <option value="Pendente">Aguardando Análise</option>
                <option value="Validado">Validado</option>
                <option value="Retificar">Retificação Solicitada</option>
              </select>
            </div>

            <div className="bg-card rounded-2xl border border-border shadow-soft overflow-hidden">
              {loading ? (
                <div className="flex flex-col items-center justify-center p-20 text-muted-foreground">
                  <Loader2 className="w-8 h-8 animate-spin mb-4 text-primary" />
                  <p>Carregando fila de imóveis...</p>
                </div>
              ) : (
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted/50 text-muted-foreground uppercase tracking-wider text-xs font-bold">
                    <tr>
                      <th className="px-6 py-4">Imóvel / CAR</th>
                      <th className="px-6 py-4">Localização</th>
                      <th className="px-6 py-4 text-center">Score</th>
                      <th className="px-6 py-4">Divergências</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredFila.map(item => {
                      const score = item.diagnostico?.scoreConformidade ?? 100;
                      const isCritico = score < 70;
                      const isAtencao = score >= 70 && score < 90;
                      
                      return (
                        <tr key={item.id} className="hover:bg-muted/30 transition-colors group">
                          <td className="px-6 py-4">
                            <div className="font-bold text-foreground">{item.nome}</div>
                            <div className="text-xs text-muted-foreground mt-0.5">{item.numeroCAR}</div>
                          </td>
                          <td className="px-6 py-4 font-medium">{item.municipio} - {item.uf}</td>
                          <td className="px-6 py-4 text-center">
                            {item.isLoading ? (
                              <Loader2 className="w-4 h-4 animate-spin mx-auto text-muted-foreground" />
                            ) : (
                              <div className={`inline-flex items-center justify-center w-10 h-10 rounded-full font-bold border-2 ${
                                isCritico ? "border-destructive/20 text-destructive bg-destructive/10" : 
                                isAtencao ? "border-amber-warn/20 text-amber-warn bg-amber-warn/10" : 
                                "border-primary/20 text-primary bg-primary/10"
                              }`}>
                                {score}
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            {item.isLoading ? (
                              <span className="text-muted-foreground">...</span>
                            ) : item.diagnostico?.divergencias && item.diagnostico.divergencias.length > 0 ? (
                              <div className="flex items-center gap-1.5 text-destructive font-bold">
                                <AlertTriangle className="w-4 h-4" />
                                {item.diagnostico.divergencias.length} detectadas
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 text-primary font-bold">
                                <CheckCircle2 className="w-4 h-4" />
                                Regular
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2.5 py-1 rounded-md text-[11px] font-black uppercase tracking-wider ${
                              item.status === "Validado" ? "bg-primary/20 text-primary" :
                              item.status === "Retificar" ? "bg-amber-warn/20 text-amber-warn" :
                              "bg-muted text-muted-foreground"
                            }`}>
                              {item.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <Link 
                              to={`/diagnostico`}
                              search={{ imovelId: item.id }}
                              className="inline-flex items-center justify-center px-4 py-2 bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground font-bold rounded-lg transition-colors cursor-pointer"
                            >
                              Inspecionar <ChevronRight className="w-4 h-4 ml-1" />
                            </Link>
                          </td>
                        </tr>
                      )
                    })}
                    {filteredFila.length === 0 && !loading && (
                      <tr>
                        <td colSpan={6} className="px-6 py-10 text-center text-muted-foreground">
                          Nenhum imóvel corresponde aos filtros.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {activeTab === "logs" && (
          <div className="space-y-4">
            {logs.length === 0 ? (
              <div className="bg-card rounded-2xl border border-border shadow-soft p-12 flex flex-col items-center justify-center text-center">
                <FileText className="w-12 h-12 text-muted-foreground mb-4 opacity-50" />
                <h3 className="text-lg font-bold text-foreground">Nenhuma atividade recente</h3>
                <p className="text-muted-foreground mt-1">Os laudos e pareceres que você elaborar aparecerão aqui.</p>
              </div>
            ) : (
              <div className="bg-card rounded-2xl border border-border shadow-soft overflow-hidden p-6">
                <h3 className="text-lg font-bold text-foreground mb-6">Histórico de Validações e Retificações</h3>
                <div className="space-y-6">
                  {logs.map((log) => (
                    <div key={log.id} className="flex gap-4 border-b border-border pb-6 last:border-0 last:pb-0">
                      <div className="flex flex-col items-center gap-2 mt-1">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${
                          log.acao === "Validado" ? "border-primary bg-primary/10 text-primary" : "border-amber-warn bg-amber-warn/10 text-amber-warn"
                        }`}>
                          {log.acao === "Validado" ? <CheckCircle2 className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
                        </div>
                        <div className="w-0.5 h-full bg-border flex-1" />
                      </div>
                      
                      <div className="flex-1 pt-1.5">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-bold text-foreground text-base">
                            {log.imovelNome} <span className="text-muted-foreground font-medium ml-2 text-sm">#{log.imovelId}</span>
                          </h4>
                          <time className="text-xs font-semibold text-muted-foreground bg-muted px-2 py-1 rounded">
                            {new Date(log.data).toLocaleString("pt-BR")}
                          </time>
                        </div>
                        
                        <div className="mb-3">
                          <span className={`text-xs font-black uppercase px-2 py-1 rounded-md ${
                            log.acao === "Validado" ? "bg-primary text-primary-foreground" : "bg-amber-warn text-amber-warn-foreground"
                          }`}>
                            {log.acao}
                          </span>
                        </div>
                        
                        <div className="bg-muted/40 border border-border rounded-xl p-4 text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
                          {log.detalhes}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
