import { createFileRoute, useNavigate } from "@tanstack/react-router";
import AccessibilityControls from "@/components/AccessibilityControls";
import { ArrowLeft, Settings } from "lucide-react";

export const Route = createFileRoute("/configuracoes")({
  component: ConfiguracoesScreen,
});

function ConfiguracoesScreen() {
  const navigate = useNavigate();

  return (
    <div className="flex-1 flex flex-col p-8 bg-muted/30">
      <div className="max-w-3xl w-full mx-auto space-y-6">
        
        <div className="flex flex-col gap-4">
          <button 
            onClick={() => navigate({ to: "/" })}
            className="flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors self-start"
          >
            <ArrowLeft className="w-4 h-4" /> Voltar para a Fila
          </button>
          
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center border border-primary/30">
              <Settings className="text-primary w-7 h-7" />
            </div>
            <div>
              <h2 className="text-3xl font-extrabold tracking-tight text-foreground">Configurações</h2>
              <p className="text-muted-foreground mt-1">Ajuste as preferências e acessibilidade do sistema.</p>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-2xl border border-border shadow-soft overflow-hidden p-6 mt-4">
          <h3 className="text-lg font-bold text-foreground border-b border-border pb-3 mb-6">
            Acessibilidade e Visualização
          </h3>
          
          <AccessibilityControls />
        </div>
      </div>
    </div>
  );
}
