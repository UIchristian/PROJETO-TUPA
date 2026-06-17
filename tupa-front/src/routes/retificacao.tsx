import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, Info, HelpCircle, FileText, ArrowRight } from "lucide-react";
import { MobileFrame } from "@/components/MobileFrame";
import { appStore } from "@/lib/app-store";
import { t, useTranslation } from "@/lib/i18n";

export const Route = createFileRoute("/retificacao")({
  head: () => {
    const lang = appStore.get().language || "pt";
    return {
      meta: [
        {
          title:
            lang === "es"
              ? "Rectificación del CAR · Tupã"
              : lang === "en"
                ? "CAR Rectification · Tupã"
                : "Retificação do CAR · Tupã",
        },
      ],
    };
  },
  component: RetificacaoScreen,
});

function RetificacaoScreen() {
  const { t, language } = useTranslation();

  const titleText =
    language === "es"
      ? "Rectificación del CAR"
      : language === "en"
        ? "CAR Rectification"
        : "Retificação do CAR";

  const subText =
    language === "es"
      ? "Cómo corregir las divergencias de su registro ambiental"
      : language === "en"
        ? "How to resolve environmental registration divergences"
        : "Como resolver as divergências do seu cadastro ambiental";

  return (
    <MobileFrame withNav>
      <div className="flex-1 flex flex-col bg-background text-foreground text-left">
        {/* Header */}
        <header className="px-5 pt-5 pb-3 border-b border-border bg-card shadow-soft flex items-center gap-3 shrink-0">
          <Link
            to="/diagnostico"
            className="-ml-2 p-1.5 hover:bg-secondary rounded-lg text-foreground shrink-0"
          >
            <ChevronLeft size={20} />
          </Link>
          <h1 className="text-lg font-bold text-foreground">{titleText}</h1>
        </header>

        {/* Content */}
        <div className="flex-1 p-5 flex flex-col gap-5 pb-24 overflow-y-auto no-scrollbar">
          <div className="flex flex-col gap-1.5">
            <h2 className="text-xl font-bold tracking-tight text-foreground">{titleText}</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">{subText}</p>
          </div>

          {/* Guide Card */}
          <div className="rounded-2xl border border-border bg-card p-4 shadow-card flex flex-col gap-3">
            <h3 className="font-bold text-base text-primary flex items-center gap-1.5">
              <Info size={16} />
              {language === "es"
                ? "Paso a Paso del Processo"
                : language === "en"
                  ? "Step-by-Step Process"
                  : "Passo a Passo do Processo"}
            </h3>

            <div className="flex flex-col gap-3 text-sm text-foreground/85 leading-relaxed mt-1">
              <div className="flex gap-2">
                <span className="shrink-0 font-bold text-primary">1.</span>
                <p>
                  {language === "es"
                    ? "Identifique el área exacta de divergencia en el mapa de Diagnóstico."
                    : language === "en"
                      ? "Identify the exact area of divergence on the Diagnostic map."
                      : "Identifique a área exata da divergência no mapa do Diagnóstico."}
                </p>
              </div>
              <div className="flex gap-2">
                <span className="shrink-0 font-bold text-primary">2.</span>
                <p>
                  {language === "es"
                    ? "Prepare el PRADA (Proyecto de Recomposición de Áreas Degradadas) con un agrónomo credenciado."
                    : language === "en"
                      ? "Prepare the PRADA (Degraded Area Recomposition Project) with a certified agronomist."
                      : "Prepare o PRADA (Projeto de Recomposição de Áreas Degradadas) com um agrônomo credenciado."}
                </p>
              </div>
              <div className="flex gap-2">
                <span className="shrink-0 font-bold text-primary">3.</span>
                <p>
                  {language === "es"
                    ? "Envíe la rectificación del polígono en el sistema oficial del CAR de su estado."
                    : language === "en"
                      ? "Submit the polygon rectification on your state's official CAR system."
                      : "Envie a retificação do polígono no sistema oficial do CAR do seu estado."}
                </p>
              </div>
            </div>
          </div>

          {/* Document Section */}
          <div className="rounded-2xl border border-border bg-card p-4 shadow-card flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 text-primary">
              <FileText size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-bold text-sm text-foreground">
                {language === "es"
                  ? "Manual de Rectificación de Imóviles"
                  : language === "en"
                    ? "Property Rectification Manual"
                    : "Manual de Retificação de Imóveis"}
              </h4>
              <p className="text-xs text-muted-foreground mt-0.5 leading-normal">
                {language === "es"
                  ? "Instrucciones oficiales de la Secretaría de Medio Ambiente."
                  : language === "en"
                    ? "Official guidelines from the Environmental Department."
                    : "Instruções oficiais da Secretaria de Meio Ambiente."}
              </p>
              <button
                type="button"
                className="mt-2.5 text-xs text-primary font-bold hover:underline flex items-center gap-0.5"
              >
                {language === "es"
                  ? "Descargar PDF (2.4 MB)"
                  : language === "en"
                    ? "Download PDF (2.4 MB)"
                    : "Baixar PDF (2.4 MB)"}
                <ArrowRight size={12} />
              </button>
            </div>
          </div>

          {/* Need help Section */}
          <div className="rounded-2xl border border-border bg-card p-4 shadow-card flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-secondary/15 flex items-center justify-center shrink-0 text-secondary-foreground">
              <HelpCircle size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-bold text-sm text-foreground">
                {language === "es"
                  ? "¿Necesita ayuda técnica?"
                  : language === "en"
                    ? "Need technical assistance?"
                    : "Precisa de ajuda técnica?"}
              </h4>
              <p className="text-xs text-muted-foreground mt-0.5 leading-normal">
                {language === "es"
                  ? "Nuestros analistas asociados pueden guiarle a través del proceso."
                  : language === "en"
                    ? "Our partner analysts can guide you through the process."
                    : "Nossos analistas parceiros podem orientar você no processo."}
              </p>
              <button
                type="button"
                className="mt-2.5 text-xs text-primary font-bold hover:underline flex items-center gap-0.5"
              >
                {language === "es"
                  ? "Hablar con un consultor"
                  : language === "en"
                    ? "Speak to a consultant"
                    : "Falar com um consultor"}
                <ArrowRight size={12} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </MobileFrame>
  );
}
