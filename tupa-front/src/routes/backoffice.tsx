import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useState, useMemo } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Filter,
  Loader2,
  RefreshCcw,
  Search,
  XCircle,
  MapPin,
  FileText,
} from "lucide-react";
import { getImoveis, getDiagnostico, getLayers } from "@/api";
import type { Imovel, Diagnostico, LayerGeometries } from "@/types/imovel";

const TupaMap = lazy(() => import("@/components/TupaMap"));

export const Route = createFileRoute("/backoffice")({
  head: () => ({
    meta: [{ title: "Backoffice Analista - Tupã" }],
  }),
  component: BackofficeAnalistaScreen,
});

function BackofficeAnalistaScreen() {
  const [imoveis, setImoveis] = useState<Imovel[]>([]);
  const [diagnosticos, setDiagnosticos] = useState<Record<string, Diagnostico>>({});
  const [loading, setLoading] = useState(true);
  const [loadingLayers, setLoadingLayers] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState<"todos" | "alta" | "media" | "baixa">(
    "todos",
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [layers, setLayers] = useState<LayerGeometries | null>(null);

  const [motivoRetificacao, setMotivoRetificacao] = useState("");
  const [showRejectModal, setShowRejectModal] = useState(false);

  // Load properties and their diagnostics
  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const list = await getImoveis();
      setImoveis(list);

      const diags: Record<string, Diagnostico> = {};
      // For a real app we would paginate or have an endpoint that returns the list with scores.
      // For this MVP, we fetch individually if needed, or assume getDiagnostico handles it fast enough.
      await Promise.all(
        list.map(async (imovel) => {
          try {
            const diag = await getDiagnostico(imovel.id);
            if (diag) {
              diags[imovel.id] = diag;
            }
          } catch (e) {
            console.error(`Erro ao carregar diagnóstico para ${imovel.id}`, e);
          }
        }),
      );
      setDiagnosticos(diags);

      if (list.length > 0 && !selectedId) {
        setSelectedId(list[0].id);
      }
    } catch (err) {
      console.error(err);
      setError("Não foi possível carregar a fila de imóveis.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Load layers when selection changes
  useEffect(() => {
    async function loadLays() {
      if (!selectedId) {
        setLayers(null);
        return;
      }
      setLoadingLayers(true);
      try {
        const lay = await getLayers(selectedId);
        setLayers(lay);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingLayers(false);
      }
    }
    loadLays();
  }, [selectedId]);

  // Derived state: filtered and sorted list
  const filaOrdenada = useMemo(() => {
    const result = imoveis.filter((im) => {
      // Search by CAR
      if (search && !im.numeroCAR.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }
      // Filter by severity
      if (severityFilter !== "todos") {
        const diag = diagnosticos[im.id];
        if (!diag) return false;
        const hasSeverity = diag.divergencias.some((d) => d.severidade === severityFilter);
        if (!hasSeverity) return false;
      }
      return true;
    });

    // Order by lowest score (most severe first)
    result.sort((a, b) => {
      const scoreA = diagnosticos[a.id]?.scoreConformidade ?? 100;
      const scoreB = diagnosticos[b.id]?.scoreConformidade ?? 100;
      return scoreA - scoreB;
    });

    return result;
  }, [imoveis, diagnosticos, search, severityFilter]);

  const handleValidar = () => {
    if (!selectedId) return;
    // Remove from local list as "processed"
    setImoveis((prev) => prev.filter((im) => im.id !== selectedId));
    setSelectedId(null);
  };

  const handleRetificar = () => {
    if (!selectedId || !motivoRetificacao.trim()) return;
    // Removes from local list as "returned"
    setImoveis((prev) => prev.filter((im) => im.id !== selectedId));
    setSelectedId(null);
    setShowRejectModal(false);
    setMotivoRetificacao("");
  };

  const selectedImovel = imoveis.find((i) => i.id === selectedId);
  const selectedDiagnostico = selectedId ? diagnosticos[selectedId] : null;

  return (
    <div className="flex flex-col h-screen bg-[#f5f6f8] text-slate-900 overflow-hidden font-sans">
      {/* Header */}
      <header className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-6 shrink-0 shadow-sm z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
            <CheckCircle2 className="text-emerald-700 w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold leading-tight">Backoffice - Análise CAR</h1>
            <p className="text-xs text-slate-500 font-medium">Analista: Luana</p>
          </div>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="h-9 px-4 rounded-lg border border-slate-300 bg-white text-sm font-semibold hover:bg-slate-50 disabled:opacity-60 flex items-center gap-2 transition-colors cursor-pointer"
        >
          <RefreshCcw size={15} className={loading ? "animate-spin" : ""} /> Atualizar Fila
        </button>
      </header>

      {/* Main Layout */}
      <main className="flex-1 flex overflow-hidden">
        {/* Left Column: Priority Queue */}
        <aside className="w-96 flex flex-col border-r border-slate-200 bg-white shrink-0 z-0 shadow-[4px_0_12px_rgba(0,0,0,0.02)] relative">
          <div className="p-4 border-b border-slate-100 flex flex-col gap-3">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center justify-between">
              Fila de Análise
              <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-xs">
                {filaOrdenada.length}
              </span>
            </h2>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Buscar por CAR..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
              <Filter className="w-4 h-4 text-slate-400 shrink-0" />
              {(["todos", "alta", "media", "baixa"] as const).map((sev) => (
                <button
                  key={sev}
                  onClick={() => setSeverityFilter(sev)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                    severityFilter === sev
                      ? "bg-slate-800 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {sev === "todos" ? "Todos" : `Severidade ${sev}`}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {loading ? (
              <div className="flex justify-center p-8">
                <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
              </div>
            ) : filaOrdenada.length === 0 ? (
              <div className="text-center p-8 text-slate-500 text-sm font-medium">
                Nenhum imóvel na fila.
              </div>
            ) : (
              filaOrdenada.map((imovel) => {
                const diag = diagnosticos[imovel.id];
                const score = diag?.scoreConformidade ?? 100;
                const isSelected = selectedId === imovel.id;

                let scoreColor = "text-emerald-700 bg-emerald-50 border-emerald-200";
                if (score < 90) scoreColor = "text-amber-700 bg-amber-50 border-amber-200";
                if (score < 60) scoreColor = "text-rose-700 bg-rose-50 border-rose-200";

                return (
                  <button
                    key={imovel.id}
                    onClick={() => setSelectedId(imovel.id)}
                    className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? "bg-emerald-50/50 border-emerald-500 shadow-sm ring-1 ring-emerald-500"
                        : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-bold text-sm text-slate-900 truncate pr-2">
                        {imovel.numeroCAR}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-md text-xs font-bold border shrink-0 ${scoreColor}`}
                      >
                        {score.toFixed(1)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500 font-medium">
                      <span className="flex items-center gap-1">
                        <MapPin size={12} /> {imovel.municipio}
                      </span>
                      <span className="flex items-center gap-1">
                        <FileText size={12} /> {imovel.areaHectares} ha
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* Right Column: Details & Map */}
        <section className="flex-1 flex flex-col bg-[#f8fafc] relative overflow-hidden">
          {!selectedImovel ? (
            <div className="flex-1 flex items-center justify-center text-slate-400 font-medium">
              Selecione um imóvel na fila para análise.
            </div>
          ) : (
            <>
              {/* Toolbar */}
              <div className="h-14 border-b border-slate-200 bg-white/80 backdrop-blur-sm px-6 flex items-center justify-between shrink-0 z-10">
                <div className="flex items-center gap-4">
                  <h2 className="font-bold text-slate-900 text-lg">{selectedImovel.numeroCAR}</h2>
                  <div className="h-4 w-px bg-slate-300"></div>
                  <span className="text-sm font-medium text-slate-600">
                    {selectedImovel.municipio} - {selectedImovel.uf} ({selectedImovel.areaHectares}{" "}
                    ha)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowRejectModal(true)}
                    className="h-9 px-4 rounded-lg font-bold text-sm bg-white border border-rose-200 text-rose-700 hover:bg-rose-50 cursor-pointer flex items-center gap-2 transition-colors"
                  >
                    <XCircle size={16} /> Devolver Retificação
                  </button>
                  <button
                    onClick={handleValidar}
                    className="h-9 px-4 rounded-lg font-bold text-sm bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm cursor-pointer flex items-center gap-2 transition-colors"
                  >
                    <CheckCircle2 size={16} /> Validar Imóvel
                  </button>
                </div>
              </div>

              {/* Map & Alerts Area */}
              <div className="flex-1 flex overflow-hidden p-6 gap-6">
                {/* Map Container */}
                <div className="flex-[2] rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden relative flex flex-col">
                  <div className="absolute top-4 left-4 z-[1000] bg-white/90 backdrop-blur px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm text-xs font-bold text-slate-700">
                    Visão de Conformidade (Declarado vs Observado)
                  </div>

                  {loadingLayers ? (
                    <div className="flex-1 flex items-center justify-center bg-slate-50">
                      <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                    </div>
                  ) : layers ? (
                    <div className="flex-1 relative">
                      <Suspense fallback={<div className="flex-1 bg-slate-50" />}>
                        {!import.meta.env.SSR && (
                          <TupaMap
                            imovel={selectedImovel}
                            layers={layers}
                            showDeclared={true}
                            showApp={true}
                            showRestrito={true}
                            showUsoCobertura={true}
                            showDivergencias={true}
                          />
                        )}
                      </Suspense>
                    </div>
                  ) : (
                    <div className="flex-1 flex items-center justify-center bg-slate-50 text-slate-400 font-medium">
                      Camadas geoespaciais indisponíveis.
                    </div>
                  )}
                </div>

                {/* Alerts Sidebar */}
                <div className="flex-1 flex flex-col gap-4 overflow-y-auto pr-2 no-scrollbar">
                  <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider mb-1">
                    Painel de Alertas
                  </h3>

                  {selectedDiagnostico?.divergencias.length === 0 ? (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 flex flex-col items-center text-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                        <CheckCircle2 size={24} />
                      </div>
                      <div>
                        <h4 className="font-bold text-emerald-900">Nenhuma divergência</h4>
                        <p className="text-sm text-emerald-700/80 mt-1">
                          O polígono declarado está compatível com as imagens de satélite.
                        </p>
                      </div>
                    </div>
                  ) : (
                    selectedDiagnostico?.divergencias.map((div) => (
                      <div
                        key={div.id}
                        className="rounded-xl border border-rose-200 bg-white p-4 shadow-sm flex flex-col gap-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-bold text-slate-900 leading-tight">{div.tipo}</h4>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              div.severidade === "alta"
                                ? "bg-rose-100 text-rose-700"
                                : "bg-amber-100 text-amber-700"
                            }`}
                          >
                            {div.severidade}
                          </span>
                        </div>
                        <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100">
                          {div.textoLinguagemSimples}
                        </p>
                        <div className="flex items-center gap-4 mt-1 text-xs font-semibold text-slate-500">
                          <span className="flex items-center gap-1.5">
                            <AlertTriangle size={14} className="text-rose-500" /> Área:{" "}
                            {div.areaHectares} ha
                          </span>
                          <span className="flex items-center gap-1.5">
                            <FileText size={14} /> {div.baseLegal}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </section>
      </main>

      {/* Retification Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-[60] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md p-6">
            <h3 className="font-bold text-lg text-slate-900 mb-2">Devolver para Retificação</h3>
            <p className="text-sm text-slate-500 mb-4">
              Informe o motivo da devolução. Este texto será exibido no aplicativo do produtor.
            </p>
            <textarea
              className="w-full h-32 p-3 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none resize-none mb-6"
              placeholder="Ex: Identificamos que parte do polígono declarado sobrepõe a APP do Rio..."
              value={motivoRetificacao}
              onChange={(e) => setMotivoRetificacao(e.target.value)}
            />
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowRejectModal(false)}
                className="px-4 py-2 rounded-lg font-bold text-sm text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleRetificar}
                disabled={!motivoRetificacao.trim()}
                className="px-4 py-2 rounded-lg font-bold text-sm bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50 transition-colors"
              >
                Confirmar Devolução
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
