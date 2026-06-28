import { createFileRoute, Outlet, Link } from "@tanstack/react-router";
import { TreePine } from "lucide-react";


export const Route = createFileRoute("/portal")({
  component: PortalLayout,
});

function PortalLayout() {
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
      <footer className="w-full bg-navy text-navy-foreground py-6 px-6 mt-8">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-center md:text-left">
          <div className="flex items-center gap-2 justify-center md:justify-start">
            <TreePine className="w-5 h-5 text-emerald-400" />
            <div>
              <span className="block font-bold text-white/90">TUPÃ</span>
              <span className="text-xs text-white/50">haCARthon · ENAP / Dataprev / SFB</span>
            </div>
          </div>
          <div className="text-xs text-white/50">
            Dados fornecidos via satélite Sentinel-2 (Copernicus) e MapBiomas.
          </div>
        </div>
      </footer>
    </div>
  );
}
