import { createFileRoute, Outlet, Link } from "@tanstack/react-router";
import { TreePine } from "lucide-react";
import { useEffect } from "react";


export const Route = createFileRoute("/portal")({
  component: PortalLayout,
});

function PortalLayout() {
  useEffect(() => {
    if (typeof window !== "undefined") {
      const scriptId = "vlibras-script";
      if (!document.getElementById(scriptId)) {
        const script = document.createElement("script");
        script.id = scriptId;
        script.src = "https://vlibras.gov.br/app/vlibras-plugin.js";
        script.onload = () => {
          if ((window as any).VLibras) {
            new (window as any).VLibras.Widget("https://vlibras.gov.br/app");
          }
        };
        document.body.appendChild(script);
      }
    }
  }, []);

  return (
    <div className="flex h-full overflow-y-auto flex-col bg-background text-foreground font-sans">
      {/* Header do Portal da Transparência */}
      <header className="sticky top-0 z-50 w-full border-b border-border bg-card shadow-soft">
        <div className="flex h-16 items-center px-4 md:px-6 justify-between">
          <Link to="/portal" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
              <TreePine className="text-emerald-600 w-6 h-6" />
            </div>
            <div>
              <span className="block text-xl font-bold tracking-tight leading-none text-foreground">
                TUPÃ
              </span>
              <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider hidden sm:block">
                Informações ambientais simplificadas para você
              </span>
            </div>
          </Link>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="flex-1 flex flex-col">
        <Outlet />
      </main>

      {/* Rodapé do Portal */}
      <footer className="w-full bg-navy text-navy-foreground pt-8 pb-12 px-6 mt-8">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <TreePine className="w-6 h-6 text-emerald-400" />
              <span className="text-xl font-bold text-white">TUPÃ</span>
            </div>
            <div className="text-sm text-white/70 max-w-sm">
              Informações ambientais simplificadas para o agricultor brasileiro.
            </div>
          </div>
          <div className="flex flex-col gap-2 text-sm text-white/80">
            <a href="#" className="hover:text-white transition-colors">Acesso à Informação</a>
            <a href="#" className="hover:text-white transition-colors">Política de Privacidade</a>
            <a href="#" className="hover:text-white transition-colors">Termos de Uso</a>
          </div>
        </div>
        <div className="max-w-4xl mx-auto mt-8 pt-6 border-t border-white/10 text-xs text-white/50 flex flex-col sm:flex-row justify-between gap-4">
          <div>haCARthon · ENAP / Dataprev / SFB</div>
          <div>Dados fornecidos via satélite Sentinel-2 (Copernicus) e MapBiomas.</div>
        </div>
      </footer>

      {/* VLibras Widget */}
      <div vw="true" className="enabled">
        <div vw-access-button="true" className="active"></div>
        <div vw-plugin-wrapper="true">
          <div className="vw-plugin-top-wrapper"></div>
        </div>
      </div>
    </div>
  );
}
