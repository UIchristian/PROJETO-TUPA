import { createFileRoute, Link } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useState, useCallback } from "react";
import {
  Loader2, X, ChevronRight, Layers, TreePine, Droplets,
  MountainSnow, CheckCircle2, AlertTriangle, ShieldAlert
} from "lucide-react";
import { PieChart, Pie, Cell, Tooltip as ReTooltip, ResponsiveContainer } from "recharts";
import {
  getMunicipioStatsApi,
  getMunicipioMapaApi,
  getMunicipioCamadasApi,
  getImovelResumoApi,
} from "@/api/client";
import type { MunicipioStats, ImovelResumo } from "@/types/imovel";

export const Route = createFileRoute("/mapa")({ component: MapaScreen });

const MunicipioMap = lazy(() => import("@/components/MunicipioMap"));

const MUNICIPIO = "abadia_dos_dourados";

const LAYERS_CONFIG = [
  { id: "APP_CURSO_DAGUA",        label: "APP Cursos d'Água",      color: "#3b82f6", icon: Droplets },
  { id: "RESERVA_LEGAL_PROPOSTA", label: "Reserva Legal Proposta", color: "#16a34a", icon: TreePine },
  { id: "USO_RESTRITO_ENCOSTA",   label: "Uso Restrito – Encosta", color: "#f97316", icon: MountainSnow },
] as const;

function scoreColor(s: number) {
  if (s >= 90) return "#22c55e";
  if (s >= 70) return "#f59e0b";
  return "#ef4444";
}

function ScoreRing({ score }: { score: number }) {
  const c = scoreColor(score);
  const r = 38;
  const circ = 2 * Math.PI * r;
  const pct = score / 100;
  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={96} height={96} className="-rotate-90">
        <circle cx={48} cy={48} r={r} fill="none" stroke="#1e293b" strokeWidth={8} />
        <circle
          cx={48} cy={48} r={r} fill="none"
          stroke={c} strokeWidth={8}
          strokeDasharray={`${circ * pct} ${circ * (1 - pct)}`}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute font-bold text-2xl" style={{ color: c }}>{score}</span>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-card border border-border rounded-none px-5 py-3 flex flex-col min-w-[140px]">
      <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">{label}</span>
      <span className="text-2xl font-extrabold text-foreground mt-0.5">{value}</span>
      {sub && <span className="text-[10px] text-muted-foreground mt-0.5">{sub}</span>}
    </div>
  );
}

export default function MapaScreen() {
  const [stats, setStats] = useState<MunicipioStats | null>(null);
  const [mapaData, setMapaData] = useState<any>(null);
  const [loadingMapa, setLoadingMapa] = useState(true);
  const [activeLayers, setActiveLayers] = useState<Set<string>>(new Set());
  const [layerCache, setLayerCache] = useState<Record<string, any>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [resumo, setResumo] = useState<ImovelResumo | null>(null);
  const [loadingResumo, setLoadingResumo] = useState(false);

  useEffect(() => {
    getMunicipioStatsApi(MUNICIPIO).then(setStats).catch(console.error);
    getMunicipioMapaApi(MUNICIPIO)
      .then(setMapaData)
      .catch(console.error)
      .finally(() => setLoadingMapa(false));
  }, []);

  const toggleLayer = useCallback(async (tipo: string) => {
    setActiveLayers(prev => {
      const next = new Set(prev);
      if (next.has(tipo)) { next.delete(tipo); return next; }
      next.add(tipo);
      return next;
    });
    if (!layerCache[tipo]) {
      try {
        const data = await getMunicipioCamadasApi(MUNICIPIO, tipo);
        setLayerCache(c => ({ ...c, [tipo]: data }));
      } catch (e) { console.error(e); }
    }
  }, [layerCache]);

  const handleSelect = useCallback(async (id: string) => {
    if (id === selectedId) { setSelectedId(null); setResumo(null); return; }
    setSelectedId(id);
    setResumo(null);
    setLoadingResumo(true);
    try {
      const r = await getImovelResumoApi(id);
      setResumo(r);
    } catch (e) { console.error(e); }
    finally { setLoadingResumo(false); }
  }, [selectedId]);

  const overlays = Object.fromEntries(
    [...activeLayers].map(t => [t, layerCache[t] ?? null])
  );

  const conformes = stats ? Math.round(stats.percConformidade) : 0;

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 64px)" }}>

      {/* ── Stats bar ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-border bg-muted/30 flex-shrink-0 overflow-x-auto">
        <div className="mr-2">
          <p className="text-sm font-bold text-foreground capitalize">{MUNICIPIO.replace(/_/g, " ")}</p>
          <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest">MG · Brasil</p>
        </div>
        <div className="w-px h-10 bg-border mx-1" />
        {stats ? (
          <>
            <StatCard label="Imóveis CAR" value={stats.totalImoveis.toLocaleString("pt-BR")} />
            <StatCard
              label="Em Conformidade"
              value={`${conformes}%`}
              sub={`score ≥ 90`}
            />
            <StatCard
              label="Score Médio"
              value={stats.mediaScore.toFixed(1)}
              sub="de 100 pts"
            />
            <StatCard
              label="APP Mapeada"
              value={`${stats.totalAppHa.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} ha`}
              sub="cursos d'água"
            />
            <StatCard
              label="Reserva Legal"
              value={`${stats.totalRlHa.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} ha`}
              sub="proposta"
            />
          </>
        ) : (
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        )}
      </div>

      {/* ── Main area ─────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Sidebar – layers + legend */}
        <aside className="w-56 flex-shrink-0 flex flex-col border-r border-border bg-card overflow-y-auto">
          <div className="px-4 pt-4 pb-2">
            <p className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5" /> Camadas
            </p>
          </div>

          <div className="px-3 space-y-1 pb-4">
            {LAYERS_CONFIG.map(({ id, label, color, icon: Icon }) => {
              const active = activeLayers.has(id);
              return (
                <button
                  key={id}
                  onClick={() => toggleLayer(id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-none text-xs font-mono transition-all border ${
                    active
                      ? "border-transparent text-foreground bg-muted"
                      : "border-transparent text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  <span
                    className="w-3 h-3 rounded-sm flex-shrink-0 border"
                    style={{
                      background: active ? color : "transparent",
                      borderColor: color,
                    }}
                  />
                  <Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color }} />
                  <span className="text-left leading-tight">{label}</span>
                </button>
              );
            })}
          </div>

          <div className="px-4 pt-2 pb-2 border-t border-border">
            <p className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-muted-foreground mb-2">Score</p>
            <div className="space-y-1.5 text-[11px] font-mono">
              {[
                { label: "Conforme (90–100)", c: "#22c55e" },
                { label: "Atenção (70–89)",   c: "#f59e0b" },
                { label: "Crítico (< 70)",    c: "#ef4444" },
              ].map(({ label, c }) => (
                <div key={label} className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: c }} />
                  <span className="text-muted-foreground">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* Map */}
        <div className="flex-1 relative">
          {loadingMapa && (
            <div className="absolute inset-0 z-[1000] flex flex-col items-center justify-center bg-background/80">
              <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
              <p className="text-sm text-muted-foreground font-mono">Carregando {MUNICIPIO.replace(/_/g, " ")}...</p>
            </div>
          )}
          {!import.meta.env.SSR && (
            <Suspense fallback={null}>
              <MunicipioMap
                featureCollection={mapaData}
                overlays={overlays}
                selectedId={selectedId}
                onSelect={handleSelect}
              />
            </Suspense>
          )}
        </div>

        {/* Detail panel */}
        {selectedId && (
          <aside className="w-96 flex-shrink-0 border-l border-border bg-card overflow-y-auto flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-card z-10">
              <p className="text-xs font-mono font-bold text-primary uppercase tracking-widest">
                Imóvel Selecionado
              </p>
              <button
                onClick={() => { setSelectedId(null); setResumo(null); }}
                className="w-7 h-7 flex items-center justify-center rounded-none hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {loadingResumo && (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            )}

            {resumo && !loadingResumo && (
              <div className="flex-1 flex flex-col gap-0">
                {/* Score */}
                <div className="flex items-center gap-5 px-5 py-5 border-b border-border">
                  <ScoreRing score={resumo.scoreConformidade} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest">CAR</p>
                    <p className="text-[11px] font-mono text-foreground break-all leading-snug mt-0.5">
                      {resumo.numeroCar}
                    </p>
                    <div className="mt-2 flex items-center gap-1.5">
                      {resumo.scoreConformidade >= 90 ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      ) : resumo.scoreConformidade >= 70 ? (
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                      ) : (
                        <ShieldAlert className="w-4 h-4 text-red-500" />
                      )}
                      <span className="text-xs font-semibold" style={{ color: scoreColor(resumo.scoreConformidade) }}>
                        {resumo.scoreConformidade >= 90 ? "Em Conformidade" :
                         resumo.scoreConformidade >= 70 ? "Atenção" : "Crítico"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Divergências */}
                <div className="px-5 py-4 border-b border-border">
                  <p className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-muted-foreground mb-3">
                    Divergências ({resumo.divergencias.length})
                  </p>
                  {resumo.divergencias.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Nenhuma divergência detectada.</p>
                  ) : (
                    <div className="space-y-2">
                      {resumo.divergencias.map((d, i) => (
                        <div key={i} className="flex items-start gap-2.5 text-xs">
                          <span className={`mt-0.5 px-1.5 py-0.5 text-[9px] font-mono font-black uppercase rounded-none flex-shrink-0 ${
                            d.severidade === "alta" ? "bg-red-500/15 text-red-400" :
                            d.severidade === "media" ? "bg-amber-500/15 text-amber-400" :
                            "bg-muted text-muted-foreground"
                          }`}>
                            {d.severidade}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="font-mono text-[10px] text-foreground uppercase tracking-wider">{d.tipo.replace(/_/g, " ")}</p>
                            {d.areaHectares > 0 && (
                              <p className="text-muted-foreground text-[10px] mt-0.5">
                                {d.areaHectares.toFixed(2)} ha
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Cobertura */}
                {resumo.coberturaSolo.length > 0 && (
                  <div className="px-5 py-4 border-b border-border">
                    <p className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-muted-foreground mb-3">
                      Cobertura do Solo
                    </p>
                    <ResponsiveContainer width="100%" height={140}>
                      <PieChart>
                        <Pie
                          data={resumo.coberturaSolo}
                          dataKey="percentual"
                          nameKey="classe"
                          cx="50%"
                          cy="50%"
                          innerRadius={35}
                          outerRadius={60}
                          paddingAngle={1}
                        >
                          {resumo.coberturaSolo.map((c, i) => (
                            <Cell key={i} fill={c.corHex} />
                          ))}
                        </Pie>
                        <ReTooltip
                          formatter={(value: any, name: string) => [`${value}%`, name]}
                          contentStyle={{
                            background: "#0f172a",
                            border: "1px solid #1e293b",
                            borderRadius: 0,
                            fontSize: 11,
                            fontFamily: "monospace",
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-1 mt-2">
                      {resumo.coberturaSolo
                        .slice()
                        .sort((a, b) => b.percentual - a.percentual)
                        .slice(0, 6)
                        .map((c, i) => (
                          <div key={i} className="flex items-center justify-between text-[10px] font-mono">
                            <div className="flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: c.corHex }} />
                              <span className="text-muted-foreground truncate max-w-[160px]">{c.classe}</span>
                            </div>
                            <span className="text-foreground font-semibold">{c.percentual.toFixed(1)}%</span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Link to full diagnostico */}
                <div className="px-5 py-4">
                  <Link
                    to="/diagnostico"
                    search={{ imovelId: selectedId }}
                    className="w-full flex items-center justify-center gap-2 py-2 border border-primary text-primary text-xs font-mono font-bold hover:bg-primary hover:text-black transition-all"
                  >
                    [VER DIAGNÓSTICO COMPLETO] <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}
