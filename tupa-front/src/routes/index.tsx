import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import {
  Loader2,
  Search,
  ShieldAlert,
  CheckCircle2,
  ChevronRight,
  AlertTriangle,
  FileText,
  History,
  ChevronLeft,
} from "lucide-react";
import { getImoveisApi } from "@/api/client";
import { useAppState } from "@/lib/app-store";

export const Route = createFileRoute("/")({ component: FilaScreen });

const PAGE_SIZE = 10;

interface FilaItem {
  id: string;
  nome: string;
  municipio: string;
  uf: string;
  numeroCAR: string;
  score: number;
  nDivergencias: number;
  maxSeveridade: string | null;
  status: "Pendente" | "Validado" | "Retificar";
}

function FilaScreen() {
  const { logs } = useAppState();
  const [activeTab, setActiveTab] = useState<"fila" | "logs">("fila");
  const [fila, setFila] = useState<FilaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterUf, setFilterUf] = useState("");
  const [filterScore, setFilterScore] = useState("");
  const [filterSeveridade, setFilterSeveridade] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  useEffect(() => {
    setLoading(true);
    getImoveisApi()
      .then((imoveis) => {
        setFila(
          imoveis.map((im: any) => {
            const log = logs.find((l) => l.imovelId === im.id);
            const status: FilaItem["status"] = log
              ? log.acao === "Validado"
                ? "Validado"
                : "Retificar"
              : "Pendente";
            return {
              id: im.id,
              nome: im.nome,
              municipio: im.municipio,
              uf: im.uf,
              numeroCAR: im.numeroCAR ?? im.numero_car ?? im.id,
              score: im.score ?? 100,
              nDivergencias: (im as any).nDivergencias ?? (im as any).n_divergencias ?? 0,
              maxSeveridade: (im as any).maxSeveridade ?? (im as any).max_severidade ?? null,
              status,
            };
          }),
        );
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [logs]);

  // Reset page when filters change
  useEffect(() => {
    setPage(0);
  }, [searchTerm, filterUf, filterScore, filterSeveridade, filterStatus]);

  const filtered = useMemo(() => {
    return fila.filter((item) => {
      if (
        searchTerm &&
        !item.nome.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !item.numeroCAR.toLowerCase().includes(searchTerm.toLowerCase())
      )
        return false;
      if (filterUf && item.uf !== filterUf) return false;
      if (filterStatus && item.status !== filterStatus) return false;

      if (filterScore === "critico" && item.score >= 70) return false;
      if (filterScore === "atencao" && (item.score < 70 || item.score >= 90)) return false;
      if (filterScore === "regular" && item.score < 90) return false;

      if (filterSeveridade) {
        if (filterSeveridade === "Nenhuma" && item.nDivergencias > 0) return false;
        if (
          filterSeveridade !== "Nenhuma" &&
          item.maxSeveridade?.toLowerCase() !== filterSeveridade.toLowerCase()
        )
          return false;
      }

      return true;
    });
  }, [fila, searchTerm, filterUf, filterScore, filterSeveridade, filterStatus]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageItems = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className="flex-1 flex flex-col p-8 bg-muted/30">
      <div className="max-w-7xl w-full mx-auto space-y-6">
        <div className="flex justify-between items-end border-b border-border pb-4">
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight text-foreground">
              Painel de Auditoria
            </h2>
            <p className="text-muted-foreground mt-1">
              Gerencie as inspeções e o histórico do CAR.
            </p>
          </div>
          <div className="flex gap-2 p-1 bg-card border border-border rounded-none shadow-premium">
            <button
              onClick={() => setActiveTab("fila")}
              className={`px-6 py-2 rounded-none text-xs font-mono uppercase tracking-wider font-bold transition-all ${activeTab === "fila" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
            >
              [ Fila de Análise ]
            </button>
            <button
              onClick={() => setActiveTab("logs")}
              className={`px-6 py-2 rounded-none text-xs font-mono uppercase tracking-wider font-bold transition-all flex items-center gap-2 ${activeTab === "logs" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
            >
              <History className="w-4 h-4" /> Histórico ({logs.length})
            </button>
          </div>
        </div>

        {activeTab === "fila" && (
          <div className="space-y-4">
            {/* Filtros */}
            <div className="bg-card border border-border rounded-none shadow-premium p-4 flex flex-wrap gap-4 items-center relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
              <div className="relative flex-1 min-w-[250px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary" />
                <input
                  type="text"
                  placeholder="BUSCAR POR CAR OU NOME..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-4 py-2 w-full rounded-none border border-border bg-background text-xs font-mono uppercase tracking-wider focus:outline-none focus:border-primary transition-all"
                />
              </div>
              <select
                value={filterUf}
                onChange={(e) => setFilterUf(e.target.value)}
                className="py-2 px-3 rounded-none border border-border bg-background text-xs font-mono uppercase tracking-wider focus:outline-none focus:border-primary transition-all"
              >
                <option value="">TODOS OS ESTADOS</option>
                {[
                  "AC",
                  "AL",
                  "AP",
                  "AM",
                  "BA",
                  "CE",
                  "DF",
                  "ES",
                  "GO",
                  "MA",
                  "MT",
                  "MS",
                  "MG",
                  "PA",
                  "PB",
                  "PR",
                  "PE",
                  "PI",
                  "RJ",
                  "RN",
                  "RS",
                  "RO",
                  "RR",
                  "SC",
                  "SP",
                  "SE",
                  "TO",
                ].map((uf) => (
                  <option key={uf} value={uf}>
                    {uf}
                  </option>
                ))}
              </select>
              <select
                value={filterScore}
                onChange={(e) => setFilterScore(e.target.value)}
                className="py-2 px-3 rounded-none border border-border bg-background text-xs font-mono uppercase tracking-wider focus:outline-none focus:border-primary transition-all"
              >
                <option value="">QUALQUER SCORE</option>
                <option value="critico">CRÍTICO (0–69)</option>
                <option value="atencao">ATENÇÃO (70–89)</option>
                <option value="regular">REGULAR (90–100)</option>
              </select>
              <select
                value={filterSeveridade}
                onChange={(e) => setFilterSeveridade(e.target.value)}
                className="py-2 px-3 rounded-none border border-border bg-background text-xs font-mono uppercase tracking-wider focus:outline-none focus:border-primary transition-all"
              >
                <option value="">QUALQUER SEVERIDADE</option>
                <option value="alta">ALTA</option>
                <option value="media">MÉDIA</option>
                <option value="baixa">BAIXA</option>
                <option value="Nenhuma">SEM DIVERGÊNCIA</option>
              </select>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="py-2 px-3 rounded-none border border-border bg-background text-xs font-mono uppercase tracking-wider focus:outline-none focus:border-primary transition-all"
              >
                <option value="">TODOS OS STATUS</option>
                <option value="Pendente">AGUARDANDO</option>
                <option value="Validado">VALIDADO</option>
                <option value="Retificar">RETIFICAR</option>
              </select>
            </div>

            <div className="bg-card rounded-none border border-border shadow-premium overflow-hidden">
              {loading ? (
                <div className="flex flex-col items-center justify-center p-20 text-muted-foreground">
                  <Loader2 className="w-8 h-8 animate-spin mb-4 text-primary" />
                  <p className="font-mono text-sm">Carregando fila de imóveis...</p>
                </div>
              ) : (
                <>
                  <table className="w-full text-sm text-left">
                    <thead className="bg-muted text-primary font-mono uppercase tracking-[0.2em] text-[10px] font-bold border-b border-border">
                      <tr>
                        <th className="px-6 py-4">ID_IMÓVEL // CAR</th>
                        <th className="px-6 py-4">COORD_LOC</th>
                        <th className="px-6 py-4 text-center">CONF_SCORE</th>
                        <th className="px-6 py-4">DIVERG_DETECT</th>
                        <th className="px-6 py-4">SYS_STATUS</th>
                        <th className="px-6 py-4 text-right">CMD_EXEC</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {pageItems.map((item) => {
                        const isCritico = item.score < 70;
                        const isAtencao = item.score >= 70 && item.score < 90;
                        return (
                          <tr key={item.id} className="hover:bg-muted/50 transition-colors group">
                            <td className="px-6 py-4">
                              <div className="font-bold text-foreground font-mono uppercase text-sm tracking-wide">
                                {item.nome}
                              </div>
                              <div className="text-[10px] text-muted-foreground mt-0.5 font-mono tracking-widest">
                                {item.numeroCAR}
                              </div>
                            </td>
                            <td className="px-6 py-4 font-mono text-xs text-muted-foreground uppercase tracking-widest">
                              {item.municipio} - {item.uf}
                            </td>
                            <td className="px-6 py-4 text-center">
                              <div
                                className={`inline-flex items-center justify-center px-3 py-1 font-mono font-bold border ${
                                  isCritico
                                    ? "border-destructive text-destructive bg-destructive/10"
                                    : isAtencao
                                      ? "border-amber-warn text-amber-warn bg-amber-warn/10"
                                      : "border-primary text-primary bg-primary/10"
                                }`}
                              >
                                [{String(Math.round(item.score)).padStart(3, "0")}]
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              {item.nDivergencias > 0 ? (
                                <div className="flex items-center gap-1.5 text-destructive font-bold font-mono text-xs uppercase tracking-wider">
                                  <AlertTriangle className="w-4 h-4" />
                                  {item.nDivergencias} CONFLITO{item.nDivergencias !== 1 ? "S" : ""}
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5 text-primary font-bold font-mono text-xs uppercase tracking-wider">
                                  <CheckCircle2 className="w-4 h-4" />
                                  LIMPO
                                </div>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <span
                                className={`px-2 py-1 border text-[10px] font-mono font-black uppercase tracking-widest ${
                                  item.status === "Validado"
                                    ? "border-primary bg-primary/10 text-primary"
                                    : item.status === "Retificar"
                                      ? "border-amber-warn bg-amber-warn/10 text-amber-warn"
                                      : "border-muted-foreground bg-muted text-muted-foreground"
                                }`}
                              >
                                {item.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <Link
                                to="/diagnostico"
                                search={{ imovelId: item.id }}
                                className="inline-flex items-center justify-center px-4 py-1.5 border border-primary text-primary hover:bg-primary hover:text-black font-mono text-xs font-bold transition-all"
                              >
                                [INSPECIONAR] <ChevronRight className="w-4 h-4 ml-1" />
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                      {pageItems.length === 0 && (
                        <tr>
                          <td
                            colSpan={6}
                            className="px-6 py-10 text-center text-muted-foreground font-mono text-sm"
                          >
                            Nenhum imóvel corresponde aos filtros.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>

                  {/* Paginação */}
                  <div className="flex items-center justify-between px-6 py-3 border-t border-border bg-muted/20">
                    <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
                      {filtered.length} imóvel{filtered.length !== 1 ? "is" : ""} &nbsp;·&nbsp;
                      página {page + 1} de {Math.max(1, totalPages)}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setPage((p) => Math.max(0, p - 1))}
                        disabled={page === 0}
                        className="flex items-center gap-1 px-3 py-1.5 border border-border font-mono text-xs text-muted-foreground hover:border-primary hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" /> PREV
                      </button>

                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        const start = Math.max(0, Math.min(page - 2, totalPages - 5));
                        const p = start + i;
                        return (
                          <button
                            key={p}
                            onClick={() => setPage(p)}
                            className={`w-8 h-8 font-mono text-xs border transition-all ${
                              p === page
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border text-muted-foreground hover:border-primary hover:text-primary"
                            }`}
                          >
                            {p + 1}
                          </button>
                        );
                      })}

                      <button
                        onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                        disabled={page >= totalPages - 1}
                        className="flex items-center gap-1 px-3 py-1.5 border border-border font-mono text-xs text-muted-foreground hover:border-primary hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                      >
                        NEXT <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </>
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
                <p className="text-muted-foreground mt-1">
                  Os laudos e pareceres que você elaborar aparecerão aqui.
                </p>
              </div>
            ) : (
              <div className="bg-card rounded-2xl border border-border shadow-soft overflow-hidden p-6">
                <h3 className="text-lg font-bold text-foreground mb-6">
                  Histórico de Validações e Retificações
                </h3>
                <div className="space-y-6">
                  {logs.map((log) => (
                    <div
                      key={log.id}
                      className="flex gap-4 border-b border-border pb-6 last:border-0 last:pb-0"
                    >
                      <div className="flex flex-col items-center gap-2 mt-1">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${
                            log.acao === "Validado"
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-amber-warn bg-amber-warn/10 text-amber-warn"
                          }`}
                        >
                          {log.acao === "Validado" ? (
                            <CheckCircle2 className="w-5 h-5" />
                          ) : (
                            <ShieldAlert className="w-5 h-5" />
                          )}
                        </div>
                        <div className="w-0.5 h-full bg-border flex-1" />
                      </div>
                      <div className="flex-1 pt-1.5">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-bold text-foreground text-base">
                            {log.imovelNome}{" "}
                            <span className="text-muted-foreground font-medium ml-2 text-sm">
                              #{log.imovelId}
                            </span>
                          </h4>
                          <time className="text-xs font-semibold text-muted-foreground bg-muted px-2 py-1 rounded">
                            {new Date(log.data).toLocaleString("pt-BR")}
                          </time>
                        </div>
                        <div className="mb-3">
                          <span
                            className={`text-xs font-black uppercase px-2 py-1 rounded-md ${
                              log.acao === "Validado"
                                ? "bg-primary text-primary-foreground"
                                : "bg-amber-warn text-amber-warn-foreground"
                            }`}
                          >
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
