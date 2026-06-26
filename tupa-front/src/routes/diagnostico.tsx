import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useState } from "react";
import { z } from "zod";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ShieldAlert,
  Map as MapIcon,
  Layers,
  Info,
  Wrench,
  ArrowLeft,
  Satellite,
  TreePine,
  Pickaxe,
  Droplets,
} from "lucide-react";

function InfoTip({ text }: { text: string }) {
  return (
    <span className="relative group shrink-0 cursor-default" onClick={(e) => e.preventDefault()}>
      <Info className="w-3.5 h-3.5 text-muted-foreground/60 hover:text-primary transition-colors" />
      <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-56 bg-popover text-popover-foreground border border-border text-xs font-normal rounded-lg px-3 py-2 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-[600] leading-relaxed">
        {text}
        <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-border" />
      </span>
    </span>
  );
}

import { getImovel, getDiagnostico, getLayers } from "@/api";
import type { Imovel, Diagnostico, LayerGeometries } from "@/types/imovel";

const TupaMap = lazy(() => import("@/components/TupaMap"));

export const Route = createFileRoute("/diagnostico")({
  validateSearch: z.object({
    imovelId: z.string().optional(),
  }),
  component: DiagnosticoScreen,
});

function SatelliteDashboard({
  imovel,
  diag,
  onClose,
}: {
  imovel: Imovel;
  diag: Diagnostico | null;
  onClose: () => void;
}) {
  const floresta = diag?.coberturaSolo.find(
    (c) => c.classe.includes("Floresta Nativa") || c.classe.includes("Formação"),
  );
  const usoAntropico = diag?.coberturaSolo.find(
    (c) => c.classe.includes("Lavoura") || c.classe.includes("Pastagem"),
  );

  return (
    <div className="absolute top-4 right-4 bottom-4 w-[420px] glass-card flex flex-col z-[500] shadow-premium overflow-hidden animate-in slide-in-from-right">
      <div className="p-6 border-b border-border relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 font-mono text-xs font-bold text-muted-foreground hover:text-primary transition-colors"
        >
          [X]
        </button>
        <h2 className="text-xl font-mono font-extrabold text-primary uppercase tracking-wide mb-1">
          {imovel.nome}
        </h2>
        <p className="text-[10px] font-mono text-muted-foreground tracking-widest mb-4">
          {imovel.numeroCAR}
        </p>
        <div className="flex gap-2 font-mono text-[10px] font-bold uppercase tracking-widest">
          <span className="px-2 py-1 bg-muted/50 border border-border text-primary">
            {imovel.areaHectares} HA
          </span>
          {diag && (
            <span
              className={`px-2 py-1 border ${diag.scoreConformidade >= 80 ? "bg-primary/10 text-primary border-primary " : "bg-destructive/10 text-destructive border-destructive "}`}
            >
              SCORE: [{diag.scoreConformidade.toString().padStart(3, "0")}]
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar bg-background/50">
        <div className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-primary mb-2 flex items-center gap-2">
          <Layers className="w-4 h-4" /> CRUZAMENTO_DADOS_SATELITE
        </div>

        <div className="space-y-4">
          {/* Bloco 1: Mata Protegida */}
          <div className="mb-8 p-4 border border-border bg-muted/20">
            <div className="text-[10px] text-muted-foreground tracking-[0.2em] mb-1">
              SCORE_CONFORMIDADE_SYS
            </div>
            <div className="flex items-center justify-between">
              <div className="text-xs font-mono tracking-widest text-primary">
                NOMINAL - TODOS OS SISTEMAS OK
              </div>
              <div className="text-3xl font-black text-primary tracking-widest">
                [{diag?.scoreConformidade}]
              </div>
            </div>
          </div>
          <div className="p-4 border border-primary/30 bg-primary/5 relative overflow-hidden ">
            <div className="absolute top-0 right-0 w-16 h-16 bg-primary/10 -mr-4 -mt-4 rotate-45" />
            <div className="flex items-center gap-3 mb-3 relative z-10">
              <div className="text-primary">
                <TreePine className="w-5 h-5" />
              </div>
              <h3 className="font-mono font-bold text-[10px] text-primary uppercase tracking-widest">
                MATA PROTEGIDA (APP/RL)
              </h3>
            </div>
            <p className="text-[10px] font-mono text-muted-foreground mb-2 uppercase">
              Cobertura de vegetação nativa detectada no polígono.
            </p>
            <div className="text-2xl font-mono font-black text-primary">
              [{floresta ? floresta.percentual : 0}%]{" "}
              <span className="text-[10px] font-normal text-muted-foreground uppercase tracking-widest">
                DO TOTAL
              </span>
            </div>
          </div>

          {/* Bloco 2: Uso do Solo */}
          <div className="p-4 border border-amber-warn/30 bg-amber-warn/5 relative overflow-hidden ">
            <div className="absolute top-0 right-0 w-16 h-16 bg-amber-warn/10 -mr-4 -mt-4 rotate-45" />
            <div className="flex items-center gap-3 mb-3 relative z-10">
              <div className="text-amber-warn">
                <Pickaxe className="w-5 h-5" />
              </div>
              <h3 className="font-mono font-bold text-[10px] text-amber-warn uppercase tracking-widest">
                USO ANTRÓPICO DO SOLO
              </h3>
            </div>
            <p className="text-[10px] font-mono text-muted-foreground mb-2 uppercase">
              Lavouras, pastagens ou solo exposto detectados.
            </p>
            <div className="text-2xl font-mono font-black text-amber-warn">
              [{usoAntropico ? usoAntropico.percentual : 0}%]{" "}
              <span className="text-[10px] font-normal text-muted-foreground uppercase tracking-widest">
                DO TOTAL
              </span>
            </div>
          </div>

          {/* Bloco 3: Rios e Hidrografia */}
          <div className="p-4 border border-secondary/30 bg-secondary/5 relative overflow-hidden ">
            <div className="absolute top-0 right-0 w-16 h-16 bg-secondary/10 -mr-4 -mt-4 rotate-45" />
            <div className="flex items-center gap-3 mb-3 relative z-10">
              <div className="text-secondary">
                <Droplets className="w-5 h-5" />
              </div>
              <h3 className="font-mono font-bold text-[10px] text-secondary uppercase tracking-widest">
                HIDROGRAFIA (RIOS)
              </h3>
            </div>
            <p className="text-[10px] font-mono text-muted-foreground mb-2 uppercase">
              Cursos d'água cruzando o polígono declarado.
            </p>
            <div className="text-sm font-mono font-black text-secondary uppercase tracking-widest">
              [ DETECTADO_ATIVO ]
            </div>
          </div>

          {/* Bloco 4: Alertas */}
          <div className="p-4 border border-destructive/50 bg-destructive/10 relative overflow-hidden ">
            <div className="absolute top-0 right-0 w-16 h-16 bg-destructive/20 -mr-4 -mt-4 rotate-45" />
            <div className="flex items-center gap-3 mb-3 relative z-10">
              <div className="text-destructive">
                <AlertTriangle className="w-5 h-5 animate-pulse" />
              </div>
              <h3 className="font-mono font-bold text-[10px] text-destructive uppercase tracking-widest">
                ALERTAS DE SOBREPOSIÇÃO
              </h3>
            </div>
            <p className="text-[10px] font-mono text-foreground mb-2 uppercase">
              Cruzamento com terras indígenas, quilombolas ou embargos.
            </p>
            {diag?.divergencias && diag.divergencias.length > 0 ? (
              <div className="text-destructive font-mono font-bold text-sm uppercase tracking-widest">
                [{diag.divergencias.length} AMEAÇAS ENCONTRADAS]
              </div>
            ) : (
              <div className="text-primary font-mono font-bold text-sm uppercase tracking-widest">
                [NENHUMA SOBREPOSIÇÃO]
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DiagnosticoScreen() {
  const { imovelId } = Route.useSearch();
  const navigate = useNavigate();

  const [imovel, setImovel] = useState<Imovel | null>(null);
  const [diagnostico, setDiagnostico] = useState<Diagnostico | null>(null);
  const [layers, setLayers] = useState<LayerGeometries | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Map layer controls
  const [showDeclared, setShowDeclared] = useState(true);
  const [showApp, setShowApp] = useState(true);
  const [showRestrito, setShowRestrito] = useState(true);
  const [showUsoCobertura, setShowUsoCobertura] = useState(true);
  const [showDivergencias, setShowDivergencias] = useState(true);

  // Novas camadas sugeridas
  const [showHidrografia, setShowHidrografia] = useState(false);
  const [showTerraIndigena, setShowTerraIndigena] = useState(false);
  const [showMineracao, setShowMineracao] = useState(false);
  const [showUC, setShowUC] = useState(false);

  useEffect(() => {
    async function loadData() {
      if (!imovelId) {
        setError(true);
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setError(false);
        const [im, diag, lay] = await Promise.all([
          getImovel(imovelId),
          getDiagnostico(imovelId),
          getLayers(imovelId),
        ]);

        if (!im) throw new Error("Imóvel não encontrado");

        setImovel(im);
        setDiagnostico(diag);
        setLayers(lay);
      } catch (err) {
        console.error(err);
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [imovelId, navigate]);

  const score = diagnostico?.scoreConformidade ?? 100;
  const isCritico = score < 70;
  const isAtencao = score >= 70 && score < 90;

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-muted/30">
        <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground font-semibold">Carregando dados do imóvel...</p>
      </div>
    );
  }

  if (error || !imovel) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-muted/30">
        <ShieldAlert className="w-16 h-16 text-destructive mb-4" />
        <h2 className="text-xl font-bold mb-2">Erro ao carregar imóvel</h2>
        <button
          onClick={() => navigate({ to: "/" })}
          className="mt-4 px-6 py-2 bg-primary text-primary-foreground font-bold rounded-xl"
        >
          Voltar para a Fila
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 relative overflow-hidden bg-background">
      {/* MAPA FULLSCREEN (Z-0) */}
      <div className="absolute inset-0 z-0">
        <Suspense
          fallback={
            <div className="flex flex-col items-center gap-4 animate-pulse">
              <div className="w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="font-mono text-xs uppercase tracking-widest text-primary">
                INICIALIZANDO FEED DO SATÉLITE...
              </span>
              <span className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
                ESTABELECENDO CONEXÃO SEGURA
              </span>
            </div>
          }
        >
          {!import.meta.env.SSR && layers && (
            <TupaMap
              imovel={imovel}
              layers={layers}
              showDeclared={showDeclared}
              showApp={showApp}
              showRestrito={showRestrito}
              showUsoCobertura={showUsoCobertura}
              showDivergencias={showDivergencias}
              showHidrografia={showHidrografia}
              showTerraIndigena={showTerraIndigena}
              showMineracao={showMineracao}
              showUC={showUC}
            />
          )}
        </Suspense>
      </div>

      {/* Esquerda: HUD Painel (Z-10) */}
      {!isFullscreen && (
        <div className="absolute top-4 left-4 bottom-4 w-[420px] glass-card flex flex-col overflow-y-auto no-scrollbar z-10 transition-all duration-300 animate-in slide-in-from-left">
          {/* Header Painel */}
          <div className="p-6 border-b border-border space-y-4">
            <button
              onClick={() => navigate({ to: "/" })}
              className="flex items-center gap-2 text-[10px] font-mono font-bold uppercase tracking-widest text-primary hover:text-primary/80 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> [ ABORTAR INSPEÇÃO ]
            </button>

            <div>
              <h2 className="text-xl font-mono font-extrabold text-primary uppercase tracking-wide">
                {imovel.nome}
              </h2>
              <p className="text-[10px] font-mono text-muted-foreground tracking-widest">
                {imovel.numeroCAR}
              </p>
            </div>

            <div className="flex items-center gap-2 text-[10px] font-mono font-bold uppercase tracking-widest">
              <span className="px-2 py-1 bg-muted/50 border border-border text-primary">
                {imovel.municipio} - {imovel.uf}
              </span>
              <span className="px-2 py-1 bg-muted/50 border border-border text-primary">
                {imovel.areaHectares} HA
              </span>
            </div>

            <div
              className={`p-4 border flex items-center justify-between ${
                isCritico
                  ? "bg-destructive/10 border-destructive text-destructive "
                  : isAtencao
                    ? "bg-amber-warn/10 border-amber-warn text-amber-warn "
                    : "bg-primary/10 border-primary text-primary "
              }`}
            >
              <div>
                <p className="text-[10px] font-mono font-bold uppercase tracking-widest opacity-80">
                  SYS_CONFORMITY_SCORE
                </p>
                <p className="font-mono text-xs mt-1">
                  {isCritico
                    ? "CRITICAL BREACH DETECTED"
                    : isAtencao
                      ? "WARNING: REVIEW NEEDED"
                      : "NOMINAL - ALL SYSTEMS GO"}
                </p>
              </div>
              <div className="text-4xl font-mono font-black tracking-tighter">
                [{score.toString().padStart(3, "0")}]
              </div>
            </div>
          </div>

          {/* Camadas Control */}
          <div className="mb-6 px-6">
            <div className="text-[10px] text-muted-foreground tracking-[0.2em] mb-4 flex items-center gap-2">
              <Layers className="w-3 h-3" /> CONTROLES_DE_CAMADA
            </div>
            <div className="grid grid-cols-2 gap-4">
              <label className="flex items-center gap-2 font-mono font-bold text-[9px] uppercase tracking-wider cursor-pointer select-none text-foreground hover:text-primary transition-colors">
                <input
                  type="checkbox"
                  checked={showDeclared}
                  onChange={() => setShowDeclared(!showDeclared)}
                  className="appearance-none border border-primary w-3 h-3 checked:bg-primary transition-colors shrink-0"
                />
                <span className="w-3 h-1.5 bg-primary shrink-0" />
                <span className="truncate">LIMITE_CAR</span>
              </label>
              <label className="flex items-center gap-2 font-mono font-bold text-[9px] uppercase tracking-wider cursor-pointer select-none text-foreground hover:text-primary transition-colors">
                <input
                  type="checkbox"
                  checked={showApp}
                  onChange={() => setShowApp(!showApp)}
                  className="appearance-none border border-primary w-3 h-3 checked:bg-primary transition-colors shrink-0"
                />
                <span className="w-3 h-1.5 border border-[#3b82f6] bg-[#3b82f6]/20 shrink-0" />
                <span className="truncate">APP_CODE</span>
              </label>
              {layers?.usoRestrito && (
                <label className="flex items-center gap-2 font-mono font-bold text-[9px] uppercase tracking-wider cursor-pointer select-none text-foreground hover:text-primary transition-colors">
                  <input
                    type="checkbox"
                    checked={showRestrito}
                    onChange={() => setShowRestrito(!showRestrito)}
                    className="appearance-none border border-primary w-3 h-3 checked:bg-primary transition-colors shrink-0"
                  />
                  <span className="w-3 h-1.5 border border-[#c68a35] bg-[#c68a35]/20 shrink-0" />
                  <span className="truncate">RESTRITO</span>
                </label>
              )}
              <label className="flex items-center gap-2 font-mono font-bold text-[9px] uppercase tracking-wider cursor-pointer select-none text-foreground hover:text-primary transition-colors">
                <input
                  type="checkbox"
                  checked={showUsoCobertura}
                  onChange={() => setShowUsoCobertura(!showUsoCobertura)}
                  className="appearance-none border border-primary w-3 h-3 checked:bg-primary transition-colors shrink-0"
                />
                <span className="w-3 h-1.5 bg-[#EAB308]/60 shrink-0" />
                <span className="truncate">COBERTURA</span>
              </label>
              <label className="flex items-center gap-2 font-mono font-bold text-[9px] uppercase tracking-wider cursor-pointer select-none text-foreground hover:text-primary transition-colors">
                <input
                  type="checkbox"
                  checked={showDivergencias}
                  onChange={() => setShowDivergencias(!showDivergencias)}
                  className="appearance-none border border-primary w-3 h-3 checked:bg-primary transition-colors shrink-0"
                />
                <span className="w-3 h-1.5 bg-[#ef4444] shrink-0" />
                <span className="truncate">ALERTAS</span>
              </label>
              <label className="flex items-center gap-2 font-mono font-bold text-[9px] uppercase tracking-wider cursor-pointer select-none text-foreground hover:text-primary transition-colors">
                <input
                  type="checkbox"
                  checked={showHidrografia}
                  onChange={() => setShowHidrografia(!showHidrografia)}
                  className="appearance-none border border-primary w-3 h-3 checked:bg-primary transition-colors shrink-0"
                />
                <span className="w-3 h-1.5 bg-[#0ea5e9] shrink-0" />
                <span className="truncate">HIDRO_ANA</span>
              </label>
              <label className="flex items-center gap-2 font-mono font-bold text-[9px] uppercase tracking-wider cursor-pointer select-none text-foreground hover:text-primary transition-colors">
                <input
                  type="checkbox"
                  checked={showTerraIndigena}
                  onChange={() => setShowTerraIndigena(!showTerraIndigena)}
                  className="appearance-none border border-primary w-3 h-3 checked:bg-primary transition-colors shrink-0"
                />
                <span className="w-3 h-1.5 bg-[#f97316] shrink-0" />
                <span className="truncate">INDIGENA_TI</span>
              </label>
              <label className="flex items-center gap-2 font-mono font-bold text-[9px] uppercase tracking-wider cursor-pointer select-none text-foreground hover:text-primary transition-colors">
                <input
                  type="checkbox"
                  checked={showUC}
                  onChange={() => setShowUC(!showUC)}
                  className="appearance-none border border-primary w-3 h-3 checked:bg-primary transition-colors shrink-0"
                />
                <span className="w-3 h-1.5 bg-[#10b981] shrink-0" />
                <span className="truncate">CONSERV_UC</span>
              </label>
              <label className="flex items-center gap-2 font-mono font-bold text-[9px] uppercase tracking-wider cursor-pointer select-none text-foreground hover:text-primary transition-colors">
                <input
                  type="checkbox"
                  checked={showMineracao}
                  onChange={() => setShowMineracao(!showMineracao)}
                  className="appearance-none border border-primary w-3 h-3 checked:bg-primary transition-colors shrink-0"
                />
                <span className="w-3 h-1.5 bg-[#78716c] shrink-0" />
                <span className="truncate">MINING_ANM</span>
              </label>
            </div>

            <button
              onClick={() => setIsFullscreen(true)}
              className="mt-6 w-full flex items-center justify-center gap-2 py-3 border border-primary text-primary hover:bg-primary hover:text-black font-mono font-bold text-xs tracking-widest transition-all "
            >
              <Satellite className="w-4 h-4" /> [ INICIAR VARREDURA ]
            </button>
          </div>

          {/* Divergências */}
          <div className="mb-6 px-6">
            <div className="text-[10px] text-destructive tracking-[0.2em] mb-4 flex items-center gap-2">
              <AlertTriangle className="w-3 h-3" /> ANALISE_DE_AMEACAS
            </div>

            {diagnostico?.divergencias && diagnostico.divergencias.length > 0 ? (
              <div className="space-y-4">
                {diagnostico.divergencias.map((div) => (
                  <div
                    key={div.id}
                    className="bg-destructive/10 border border-destructive p-3 relative overflow-hidden "
                  >
                    <div className="absolute top-0 left-0 w-1 h-full bg-destructive" />

                    <div className="flex justify-between items-start mb-2 pl-2">
                      <h4 className="font-mono font-bold text-destructive text-[10px] uppercase tracking-widest">
                        {div.tipo}
                      </h4>
                      <span className="bg-destructive text-black text-[9px] font-black uppercase px-1.5 py-0.5">
                        LVL: {div.severidade}
                      </span>
                    </div>

                    <p className="text-[10px] text-foreground font-mono bg-black/40 p-2 border border-destructive/30 mb-2 uppercase">
                      {div.textoLinguagemSimples}
                    </p>

                    <div className="flex items-center justify-between pt-2 border-t border-destructive/30 pl-2">
                      <span className="text-[10px] font-mono font-bold text-destructive uppercase">
                        AREA: {div.areaHectares} HA
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-6 text-center border border-primary bg-primary/5">
                <CheckCircle2 className="w-8 h-8 text-primary mb-2 opacity-80" />
                <div className="text-primary text-[10px] font-bold tracking-widest mt-2 uppercase">
                  ZERO_AMEAÇAS
                </div>
                <div className="text-muted-foreground text-[8px] tracking-widest uppercase">
                  SETOR LIMPO E SEGURO
                </div>
              </div>
            )}

            <button
              onClick={() => navigate({ to: "/retificacao", search: { imovelId: imovel.id } })}
              className="mt-4 w-full flex items-center justify-center gap-2 py-3 bg-primary text-black font-mono font-bold text-xs uppercase tracking-widest transition-all  hover:bg-white"
            >
              <Wrench className="w-4 h-4" /> [ GERAR_PARECER ]
            </button>
          </div>
        </div>
      )}

      {/* Helper overlay on map (Floating Top Right) */}
      {!isFullscreen && (
        <div className="absolute top-4 right-4 z-[400] glass-card p-3 max-w-[250px] animate-in slide-in-from-right">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <p className="text-[10px] font-mono text-primary uppercase tracking-widest leading-relaxed">
              &gt; SENSOR ARRAY ACTIVE.
              <br />
              &gt; APROXIME PARA RENDERIZAR POLÍGONOS DE CRUZAMENTO.
            </p>
          </div>
        </div>
      )}

      {/* Fullscreen Satellite Dashboard */}
      {isFullscreen && (
        <SatelliteDashboard
          imovel={imovel}
          diag={diagnostico}
          onClose={() => setIsFullscreen(false)}
        />
      )}
    </div>
  );
}
