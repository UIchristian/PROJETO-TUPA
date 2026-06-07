import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ShieldCheck, CheckCircle2, ArrowRight, AlertTriangle, FileText } from "lucide-react";
import { useState } from "react";
import { MobileFrame } from "@/components/MobileFrame";
import { useAppState, appStore } from "@/lib/app-store";
import { t, useTranslation } from "@/lib/i18n";
import { TechnicalReportModal } from "@/components/TechnicalReportModal";

export const Route = createFileRoute("/protecao/")({
  head: () => {
    const lang = appStore.get().language || "es";
    return {
      meta: [{ title: t("protection_custom.title", lang) }],
    };
  },
  component: ProtecaoScreen,
});

function ProtecaoScreen() {
  const navigate = useNavigate();
  const { farmer, carVerified } = useAppState();
  const { t, language } = useTranslation();
  const [reportOpen, setReportOpen] = useState(false);

  const handleAction = (insurerName: string) => {
    appStore.set({
      protected: true,
      selectedCooperative: insurerName,
    });
    navigate({ to: "/protecao/confirmado" });
  };

  const insuranceOptions = [
    {
      id: "newe",
      name: "Newe Seguros",
      description: t("protection_custom.newe_desc"),
      features: [
        t("protection_custom.newe_feat_cov"),
        t("protection_custom.newe_feat_pay"),
        t("protection_custom.newe_feat_foc"),
      ],
      footerNote: t("protection_custom.newe_footer"),
    },
    {
      id: "mapfre",
      name: "Mapfre",
      description: t("protection_custom.mapfre_desc"),
      features: [
        t("protection_custom.mapfre_feat_cov"),
        t("protection_custom.mapfre_feat_scope"),
        t("protection_custom.mapfre_feat_cap"),
      ],
      footerNote: t("protection_custom.mapfre_footer"),
    },
  ];

  return (
    <MobileFrame withNav>
      <header className="px-5 pt-6 pb-2">
        <h1 className="text-xl font-bold">{t("protection_custom.title")}</h1>
        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
          {t("protection_custom.subtitle")}
        </p>
      </header>

      {/* WARNING BANNER WHEN CAR NOT VERIFIED */}
      {!carVerified && (
        <div className="mx-5 my-2.5 p-4 rounded-2xl bg-amber-warn/10 border border-amber-warn/20 text-foreground flex flex-col gap-3 shadow-sm animate-in fade-in duration-200">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="text-amber-warn shrink-0 mt-0.5" size={18} />
            <div className="flex-1">
              <p className="text-sm font-bold text-amber-warn">
                {t("protection_custom.verification_warning")}
              </p>
              <p className="text-sm text-muted-foreground mt-1 font-semibold">
                {t("protection_custom.verification_status_pending")}
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate({ to: "/comprovar", search: { redirect: "/protecao" } })}
            className="w-full h-10 rounded-xl bg-amber-warn hover:opacity-90 text-amber-warn-foreground font-semibold text-sm flex items-center justify-center gap-1 active:scale-[0.99] transition-transform shadow-soft"
          >
            {t("protection_custom.verification_btn")}
          </button>
        </div>
      )}

      <div className="px-5 pb-6 flex flex-col gap-5 mt-2">
        {insuranceOptions.map((opt) => (
          <article
            key={opt.id}
            className="rounded-2xl bg-card p-4 shadow-card border border-border/60 flex flex-col gap-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-soft flex items-center justify-center shrink-0">
                  <ShieldCheck size={18} className="text-primary" />
                </div>
                <h3 className="font-bold text-base text-foreground">{opt.name}</h3>
              </div>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-sm font-extrabold bg-amber-warn/10 text-amber-warn border border-amber-warn/20 uppercase shrink-0">
                {t("protection_custom.status_eval")}
              </span>
            </div>

            <div className="rounded-xl bg-soft/50 border border-border/40 p-3.5 flex flex-col gap-2.5">
              <p className="text-sm text-foreground/90 font-medium leading-relaxed">
                {opt.description}
              </p>
              <ul className="text-sm text-muted-foreground flex flex-col gap-1.5 list-disc pl-4 border-t border-border/30 pt-2.5 mt-1">
                {opt.features.map((feat, idx) => (
                  <li key={idx} className="leading-snug">
                    {feat}
                  </li>
                ))}
              </ul>
              <div className="text-sm text-primary/80 italic border-t border-border/30 pt-2.5 mt-0.5 leading-snug">
                {t("protection_custom.example_disclaimer")}
              </div>
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed px-0.5 mt-0.5">
              {opt.footerNote}
            </p>

            <div className="border-t border-border/30 pt-3 mt-1">
              {carVerified ? (
                <button
                  onClick={() => handleAction(opt.name)}
                  className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-1.5 active:scale-[0.99] transition-transform shadow-soft"
                >
                  {t("protection.btn_know_conditions")} <ArrowRight size={14} />
                </button>
              ) : (
                <button
                  disabled
                  className="w-full h-12 rounded-xl bg-secondary text-muted-foreground font-semibold text-sm flex items-center justify-center gap-1.5 cursor-not-allowed opacity-75"
                >
                  {t("protection_custom.locked_action")}
                </button>
              )}
            </div>
          </article>
        ))}

        {/* Card de Relatório de Seguros */}
        <div className="rounded-2xl bg-card p-4 shadow-card border-2 border-primary/20 flex flex-col gap-3 text-left relative overflow-hidden bg-gradient-to-br from-primary/5 to-transparent">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <FileText size={20} />
            </div>
            <h3 className="font-bold text-base text-foreground">
              {language === "es"
                ? "Informe para Cotización"
                : language === "en"
                  ? "Report for Quoting"
                  : "Laudo para Cotação de Seguro"}
            </h3>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {language === "es"
              ? "Genere el informe satelital de Copernicus con el histórico de NDVI de los últimos 6 meses para enviar a las seguradoras asociadas."
              : language === "en"
                ? "Generate the Copernicus satellite report with the last 6 months NDVI history to send to partner insurers."
                : "Gere o laudo satelital do Copernicus com o histórico de NDVI dos últimos 6 meses para enviar às seguradoras parceiras."}
          </p>

          <button
            type="button"
            onClick={() => setReportOpen(true)}
            className="mt-1 h-11 w-full rounded-xl bg-primary hover:opacity-90 text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all cursor-pointer shadow-soft"
          >
            {language === "es"
              ? "Generar informe para cotización de seguro"
              : language === "en"
                ? "Generate report for insurance quote"
                : "Gerar laudo para cotação de seguro"}
            <ArrowRight size={14} />
          </button>
        </div>

        {/* Screen footer notice */}
        <p className="text-center text-sm text-muted-foreground/90 leading-relaxed px-4 py-2 bg-soft/30 rounded-xl border border-border/20 shadow-soft">
          {t("protection_custom.more_allies")}
        </p>
      </div>

      <TechnicalReportModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        type="insurance"
      />
    </MobileFrame>
  );
}
