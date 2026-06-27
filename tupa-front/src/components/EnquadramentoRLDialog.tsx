import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { getEnquadramentoRL } from "@/api";
import { ShieldAlert, Scale, Calculator, Info, Leaf, Check } from "lucide-react";

interface EnquadramentoRLDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  imovelId: string;
  feicaoId: string;
  onValidar: (feicaoId: string) => void;
}

export function EnquadramentoRLDialog({
  isOpen,
  onOpenChange,
  imovelId,
  feicaoId,
  onValidar,
}: EnquadramentoRLDialogProps) {
  const {
    data: enquadramento,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["enquadramentoRL", imovelId],
    queryFn: () => getEnquadramentoRL(imovelId),
    enabled: isOpen && !!imovelId,
  });

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <Scale className="w-6 h-6 text-primary" />
            <DialogTitle className="text-xl">Enquadramento da Reserva Legal</DialogTitle>
          </div>
          <DialogDescription>Memória de cálculo</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-4 py-4">
            <Skeleton className="h-24 w-full" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
            <Skeleton className="h-24 w-full" />
          </div>
        ) : isError || !enquadramento ? (
          <div className="flex flex-col items-center justify-center space-y-4 py-8 text-destructive">
            <ShieldAlert className="w-10 h-10" />
            <p className="font-semibold">Erro ao carregar a memória de cálculo.</p>
          </div>
        ) : (
          <div className="py-4 space-y-6">
            <div className="bg-primary/5 border border-primary/10 rounded-lg p-5">
              <h3 className="text-2xl font-bold text-foreground">{enquadramento.enquadramento}</h3>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                {enquadramento.observacao}
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-card border rounded-lg p-4 shadow-sm">
                <div className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 mb-1">
                  <Info className="w-3.5 h-3.5" /> Área líquida (ha)
                </div>
                <div className="text-xl font-bold font-mono">
                  {enquadramento.areaLiquidaHa.toFixed(2)}
                </div>
              </div>

              <div className="bg-card border rounded-lg p-4 shadow-sm">
                <div className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 mb-1">
                  <Calculator className="w-3.5 h-3.5" /> Módulos fiscais
                </div>
                <div className="text-xl font-bold font-mono">
                  {enquadramento.modulosFiscais.toFixed(2)}
                </div>
              </div>

              <div className="bg-card border rounded-lg p-4 shadow-sm">
                <div className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 mb-1">
                  <Leaf className="w-3.5 h-3.5" /> Bioma
                </div>
                <div className="text-xl font-bold">{enquadramento.bioma || "N/A"}</div>
              </div>

              <div className="bg-card border rounded-lg p-4 shadow-sm">
                <div className="text-xs font-medium text-muted-foreground mb-1">
                  Percentual aplicável
                </div>
                <div className="text-xl font-bold font-mono">
                  {enquadramento.percentualAplicavel.toFixed(0)}%
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-card border rounded-lg p-4 shadow-sm flex items-center justify-between">
                <div className="text-sm font-medium text-muted-foreground">
                  Reserva Legal exigida (ha)
                </div>
                <div className="text-2xl font-bold font-mono">
                  {enquadramento.rlExigidaHa.toFixed(2)}
                </div>
              </div>
              <div
                className={`border rounded-lg p-4 shadow-sm flex items-center justify-between ${enquadramento.deficitHa > 0 ? "border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900" : "bg-card"}`}
              >
                <div className="text-sm font-medium text-muted-foreground">Déficit (ha)</div>
                <div
                  className={`text-2xl font-bold font-mono ${enquadramento.deficitHa > 0 ? "text-amber-600 dark:text-amber-500" : "text-green-600 dark:text-green-500"}`}
                >
                  {enquadramento.deficitHa.toFixed(2)}
                </div>
              </div>
            </div>

            <div className="bg-muted text-muted-foreground text-sm p-4 rounded-md flex items-center gap-2">
              <Info className="w-4 h-4 shrink-0" />
              <span>Marco de 22/07/2008 a validar.</span>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
              <Button
                className="flex-1 bg-green-600 hover:bg-green-700 text-white gap-2"
                onClick={() => onValidar(feicaoId)}
              >
                <Check className="w-4 h-4" /> Validar enquadramento
              </Button>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex-1">
                      <Button variant="outline" className="w-full" disabled>
                        Anexar documento (Art. 68, manual)
                      </Button>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs">
                      O Art. 68 (Cálculo de passivo baseado na lei vigente à época do desmatamento)
                      exige análise de dinâmica temporal e submissão documental de época. Por rigor
                      jurídico, ele nunca é aplicado automaticamente pelo sistema.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
