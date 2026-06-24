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
  Droplets
} from "lucide-react";

function InfoTip({ text }: { text: string }) {
  return (
    <span className="relative group shrink-0 cursor-default" onClick={e => e.preventDefault()}>
      <Info className="w-3.5 h-3.5 text-muted-foreground/60 hover:text-primary transition-colors" />
      <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-56 bg-popover text-popover-foreground border border-border text-xs font-normal rounded-lg px-3 py-2 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-[600] leading-relaxed">
        {text}
        <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-border" />
      </span>
    </span>
  );
}

import { getImovel, getDiagnostico, getLayers } from "@/api";
import type {
  Imovel,
  Diagnostico,
  LayerGeometries,
} from "@/types/imovel";

const TupaMap = lazy(() => import("@/components/TupaMap"));

export const Route = createFileRoute("/diagnostico")({
  validateSearch: z.object({
    imovelId: z.string().optional(),
  }),
  component: DiagnosticoScreen,
});

function SatelliteDashboard({ imovel, diag, onClose }: { imovel: Imovel, diag: Diagnostico | null, onClose: () => void }) {
  const floresta = diag?.coberturaSolo.find(c => c.classe.includes("Floresta Nativa") || c.classe.includes("Formação"));
  const usoAntropico = diag?.coberturaSolo.find(c => c.classe.includes("Lavoura") || c.classe.includes("Pastagem"));

  return (
    <div className="absolute top-0 right-0 h-full w-[420px] bg-card border-l border-border flex flex-col z-[500] shadow-2xl overflow-hidden animate-in slide-in-from-right">
      <div className="p-6 border-b border-border bg-muted/10 relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground">✕</button>
        <h2 className="text-xl font-bold tracking-tight mb-1">{imovel.nome}</h2>
        <p className="text-sm text-muted-foreground mb-4">{imovel.numeroCAR}</p>
        <div className="flex gap-2">
          <span className="px-2 py-1 bg-primary/10 text-primary rounded-md text-xs font-bold border border-primary/20">
            {imovel.areaHectares} Hectares
          </span>
          {diag && (
            <span className={`px-2 py-1 rounded-md text-xs font-bold border ${diag.scoreConformidade >= 80 ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/20'}`}>
              Score: {diag.scoreConformidade}/100
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar bg-background">
        <div className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2">
          <Layers className="w-4 h-4" /> Cruzamento de Dados do Satélite
        </div>

        <div className="space-y-4">
          {/* Bloco 1: Mata Protegida */}
          <div className="p-4 rounded-xl border border-border bg-muted/5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-green-500/10 rounded-bl-full -mr-4 -mt-4" />
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-green-500/20 rounded-lg text-green-500">
                <TreePine className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-foreground">Mata Protegida (APP/RL)</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-2">Cobertura de vegetação nativa detectada no polígono.</p>
            <div className="text-2xl font-black text-foreground">
              {floresta ? floresta.percentual : 0}% <span className="text-base font-normal text-muted-foreground">do total</span>
            </div>
          </div>

          {/* Bloco 2: Uso do Solo */}
          <div className="p-4 rounded-xl border border-border bg-muted/5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-bl-full -mr-4 -mt-4" />
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-amber-500/20 rounded-lg text-amber-500">
                <Pickaxe className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-foreground">Uso Antrópico do Solo</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-2">Lavouras, pastagens ou solo exposto detectados.</p>
            <div className="text-2xl font-black text-foreground">
              {usoAntropico ? usoAntropico.percentual : 0}% <span className="text-base font-normal text-muted-foreground">do total</span>
            </div>
          </div>

          {/* Bloco 3: Rios e Hidrografia */}
          <div className="p-4 rounded-xl border border-border bg-muted/5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-bl-full -mr-4 -mt-4" />
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-blue-500/20 rounded-lg text-blue-500">
                <Droplets className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-foreground">Hidrografia (Rios)</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-2">Cursos d'água cruzando o polígono declarado.</p>
            <div className="text-2xl font-black text-foreground">
              Detectado
            </div>
          </div>

          {/* Bloco 4: Alertas (Terras Indígenas / Embargos) */}
          <div className="p-4 rounded-xl border border-destructive/30 bg-destructive/5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-destructive/10 rounded-bl-full -mr-4 -mt-4" />
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-destructive/20 rounded-lg text-destructive">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-foreground">Alertas de Sobreposição</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-2">Cruzamento com terras indígenas, quilombolas ou embargos do IBAMA.</p>
            {diag?.divergencias && diag.divergencias.length > 0 ? (
              <div className="text-destructive font-bold text-lg">
                {diag.divergencias.length} Divergência(s) Encontrada(s)
              </div>
            ) : (
              <div className="text-green-500 font-bold text-lg">
                Nenhuma sobreposição
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
    <div className="flex-1 flex overflow-hidden bg-muted/30">
      
      {/* Esquerda: Detalhes e Painel (1/3) - Oculto se isFullscreen */}
      {!isFullscreen && (
        <div className="w-[450px] bg-card border-r border-border flex flex-col overflow-y-auto no-scrollbar shadow-soft z-10 transition-all duration-300">
          
          {/* Header Painel */}
          <div className="p-6 border-b border-border space-y-4">
            <button 
              onClick={() => navigate({ to: "/" })}
              className="flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Voltar para a Fila
            </button>
            
            <div>
              <h2 className="text-2xl font-extrabold text-foreground">{imovel.nome}</h2>
              <p className="text-muted-foreground font-medium">{imovel.numeroCAR}</p>
            </div>
            
            <div className="flex items-center gap-4 text-sm font-medium">
              <span className="px-3 py-1 bg-muted rounded-lg border border-border">{imovel.municipio} - {imovel.uf}</span>
              <span className="px-3 py-1 bg-muted rounded-lg border border-border">{imovel.areaHectares} ha</span>
            </div>

            <div className={`p-4 rounded-xl border flex items-center justify-between ${
              isCritico ? "bg-destructive/10 border-destructive/20 text-destructive" : 
              isAtencao ? "bg-amber-warn/10 border-amber-warn/20 text-amber-warn" : 
              "bg-primary/10 border-primary/20 text-primary"
            }`}>
              <div>
                <p className="text-sm font-bold uppercase tracking-wider opacity-80">Score de Conformidade</p>
                <p className="font-semibold">{isCritico ? "Crítico - Ação Necessária" : isAtencao ? "Atenção" : "Regular"}</p>
              </div>
              <div className="text-3xl font-black">{score}</div>
            </div>
          </div>

          {/* Camadas Control */}
          <div className="p-6 border-b border-border">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
              <Layers className="w-4 h-4" /> Controle de Camadas
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <label className="flex items-center gap-2 font-semibold text-sm cursor-pointer select-none">
                <input type="checkbox" checked={showDeclared} onChange={() => setShowDeclared(!showDeclared)} className="rounded accent-primary w-4 h-4 shrink-0" />
                <span className="w-4 h-1.5 bg-primary rounded-sm shrink-0" />
                <span>Limite CAR</span>
                <InfoTip text="Polígono declarado pelo produtor no Cadastro Ambiental Rural (SICAR). Representa o perímetro oficial da propriedade registrado." />
              </label>
              <label className="flex items-center gap-2 font-semibold text-sm cursor-pointer select-none">
                <input type="checkbox" checked={showApp} onChange={() => setShowApp(!showApp)} className="rounded accent-primary w-4 h-4 shrink-0" />
                <span className="w-4 h-1.5 border border-dashed border-[#3b82f6] bg-[#3b82f6]/20 rounded-sm shrink-0" />
                <span>APP</span>
                <InfoTip text="Área de Preservação Permanente (Lei 12.651/2012). Faixas marginais de rios, nascentes, topos de morro e encostas. Vegetação nativa obrigatória." />
              </label>
              {layers?.usoRestrito && (
                <label className="flex items-center gap-2 font-semibold text-sm cursor-pointer select-none">
                  <input type="checkbox" checked={showRestrito} onChange={() => setShowRestrito(!showRestrito)} className="rounded accent-primary w-4 h-4 shrink-0" />
                  <span className="w-4 h-1.5 border border-dashed border-[#c68a35] bg-[#c68a35]/20 rounded-sm shrink-0" />
                  <span>Restrito</span>
                  <InfoTip text="Uso Restrito: áreas de inclinação entre 25° e 45° e pantanais. Permitem atividades com restrições específicas previstas no Código Florestal." />
                </label>
              )}
              <label className="flex items-center gap-2 font-semibold text-sm cursor-pointer select-none">
                <input type="checkbox" checked={showUsoCobertura} onChange={() => setShowUsoCobertura(!showUsoCobertura)} className="rounded accent-primary w-4 h-4 shrink-0" />
                <span className="w-4 h-1.5 bg-[#EAB308]/60 rounded-sm shrink-0" />
                <span>Cobertura</span>
                <InfoTip text="Uso e cobertura do solo detectado pelo satélite Sentinel-2 (Dynamic World / MapBiomas). Classifica: floresta nativa, lavoura, pastagem, solo exposto e corpos d'água." />
              </label>
              <label className="flex items-center gap-2 font-semibold text-sm cursor-pointer select-none">
                <input type="checkbox" checked={showDivergencias} onChange={() => setShowDivergencias(!showDivergencias)} className="rounded accent-primary w-4 h-4 shrink-0" />
                <span className="w-4 h-1.5 bg-[#ef4444] rounded-sm shrink-0" />
                <span>Divergências</span>
                <InfoTip text="Áreas onde o uso do solo observado pelo satélite conflita com as obrigações do CAR (ex.: cultivo em APP, desmatamento sem autorização). Requerem ação do produtor." />
              </label>
            </div>
            
            <button 
              onClick={() => setIsFullscreen(true)}
              className="mt-6 w-full flex items-center justify-center gap-2 py-3 bg-card border-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground font-bold rounded-xl shadow-sm transition-all"
            >
              <Satellite className="w-5 h-5" /> Abrir Satélite Copernicus
            </button>
          </div>

          {/* Divergências */}
          <div className="p-6 flex-1 flex flex-col gap-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Divergências Encontradas
            </h3>
            
            {diagnostico?.divergencias && diagnostico.divergencias.length > 0 ? (
              <div className="space-y-4">
                {diagnostico.divergencias.map(div => (
                  <div key={div.id} className="bg-card border border-destructive/20 rounded-xl p-4 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-destructive" />
                    
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-bold text-foreground text-sm leading-tight pr-2">{div.tipo}</h4>
                      <span className="bg-destructive/10 text-destructive text-[10px] font-black uppercase px-2 py-1 rounded">
                        {div.severidade}
                      </span>
                    </div>
                    
                    <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded-lg mb-3">
                      {div.textoLinguagemSimples}
                    </p>
                    
                    <div className="flex items-center justify-between mt-2 pt-3 border-t border-border">
                      <span className="text-sm font-bold">Área: {div.areaHectares} ha</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-8 text-center border border-dashed border-primary/20 rounded-xl bg-primary/5">
                <CheckCircle2 className="w-10 h-10 text-primary mb-3" />
                <p className="font-bold text-foreground">Nenhuma divergência</p>
                <p className="text-sm text-muted-foreground">O uso do solo está de acordo com as delimitações.</p>
              </div>
            )}
            
            <button 
              onClick={() => navigate({ to: "/retificacao", search: { imovelId: imovel.id } })}
              className="mt-4 w-full flex items-center justify-center gap-2 py-3 bg-primary text-primary-foreground font-bold rounded-xl shadow-premium hover:bg-primary/90 transition-all"
            >
              <Wrench className="w-4 h-4" /> Elaborar Parecer e Ação
            </button>
          </div>
        </div>
      )}

      {/* Direita: Mapa (2/3 ou Full Screen) */}
      <div className={`flex-1 relative transition-all duration-300 ${isFullscreen ? 'w-full h-full' : ''}`}>
        <Suspense fallback={
          <div className="w-full h-full flex flex-col items-center justify-center bg-muted">
            <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
            <span className="font-semibold text-muted-foreground">Carregando mapa espacial...</span>
          </div>
        }>
          {!import.meta.env.SSR && layers && (
            <TupaMap
              imovel={imovel}
              layers={layers}
              showDeclared={showDeclared}
              showApp={showApp}
              showRestrito={showRestrito}
              showUsoCobertura={showUsoCobertura}
              showDivergencias={showDivergencias}
            />
          )}
        </Suspense>
        
        {isFullscreen && (
          <SatelliteDashboard 
            imovel={imovel} 
            diag={diagnostico} 
            onClose={() => setIsFullscreen(false)} 
          />
        )}
        
        {/* Helper overlay on map */}
        {!isFullscreen && (
          <div className="absolute top-4 right-4 z-[400] bg-card/90 backdrop-blur border border-border p-3 rounded-xl shadow-premium max-w-[250px] animate-in fade-in">
            <div className="flex items-start gap-2 text-sm">
              <Info className="w-5 h-5 text-primary shrink-0" />
              <p className="text-muted-foreground font-medium leading-tight">
                Aproxime do polígono para inspecionar os cruzamentos espaciais entre o limite declarado e a cobertura observada pelo Sentinel-2.
              </p>
            </div>
          </div>
        )}
      </div>
      
    </div>
  );
}
