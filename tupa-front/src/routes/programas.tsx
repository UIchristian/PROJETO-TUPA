import { createFileRoute } from "@tanstack/react-router";
import {
  Landmark,
  ShieldCheck,
  Sprout,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Lock,
  FileText,
} from "lucide-react";
import { useState } from "react";
import { MobileFrame } from "@/components/MobileFrame";
import { useAppState, appStore } from "@/lib/app-store";
import { t, useTranslation } from "@/lib/i18n";
import { TechnicalReportModal } from "@/components/TechnicalReportModal";

export const Route = createFileRoute("/programas")({
  head: () => {
    const lang = appStore.get().language || "es";
    return {
      meta: [{ title: t("programs.title", lang) }],
    };
  },
  component: ProgramasScreen,
});

function ProgramasScreen() {
  const { farmer, carVerified } = useAppState();
  const { t, language } = useTranslation();
  const [selectedProgram, setSelectedProgram] = useState<string | null>(null);
  const [whatsappSent, setWhatsappSent] = useState(false);
  const [pushNotification, setPushNotification] = useState(false);

  const [reportOpen, setReportOpen] = useState(false);
  const [reportType, setReportType] = useState<"public" | "insurance">("public");
  const [reportProgram, setReportProgram] = useState<string | undefined>(undefined);

  // No Tupã, usamos a verificação do CAR como critério de "documento validado" para liberar os programas
  const documentoEstaValido = carVerified;

  // Eligibility map for current POC rules.
  const isEligible = {
    pronaf: true,
    garantia: false,
    proagro: true,
    psr: true,
  };

  return (
    <MobileFrame withNav>
      {/* Simulated WhatsApp Notification Banner */}
      {pushNotification && (
        <div className="absolute top-4 left-4 right-4 z-50 bg-card/95 backdrop-blur-md border border-border rounded-2xl p-4 shadow-card animate-in slide-in-from-top-12 duration-300 flex gap-3 items-start">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-base shrink-0">
            💬
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm text-foreground">WhatsApp</span>
              <span className="text-sm text-muted-foreground">
                {language === "es" ? "ahora" : language === "en" ? "now" : "agora"}
              </span>
            </div>
            <p className="text-sm text-foreground/90 mt-0.5 leading-snug">
              <strong>Tupã:</strong>{" "}
              {language === "es"
                ? "Enviamos la lista de documentos para el programa "
                : language === "en"
                  ? "We sent the document list for the program "
                  : "Enviamos a lista de documentos para o programa "}{" "}
              <span className="font-bold">{selectedProgram}</span>.
            </p>
          </div>
        </div>
      )}

      <header className="px-5 pt-6 pb-2">
        <h1 className="text-xl font-bold">{t("programs.title").split(":")[0].split(" — ")[0]}</h1>
        <p className="text-sm text-navy font-semibold mt-2 leading-snug">
          {t("programs.subtitle")}
        </p>
        <p className="text-sm text-muted-foreground mt-2 border-t border-border/40 pt-2">
          {t("programs.header", {
            property: farmer.property,
            location: farmer.location,
            area: farmer.area,
          })}
        </p>
      </header>

      <div className="px-5 pb-6 flex flex-col gap-4 mt-2">
        {/* TOP HIGHLIGHTED CARD - Relatório de Políticas Públicas */}
        <div className="rounded-2xl bg-card p-4 shadow-card border-2 border-primary/20 flex flex-col gap-3 text-left relative overflow-hidden bg-gradient-to-br from-primary/5 to-transparent">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <FileText size={20} />
            </div>
            <h3 className="font-bold text-base text-foreground">
              {language === "es"
                ? "Reporte para Políticas Públicas"
                : language === "en"
                  ? "Report for Public Policies"
                  : "Relatório para Políticas Públicas"}
            </h3>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {language === "es"
              ? "Exporte el historial de vegetación de Copernicus (NDVI) y los CAR para respaldar su solicitud de Garantia-Safra, crédito Pronaf o Laudo de Emergencia."
              : language === "en"
                ? "Export Copernicus vegetation history (NDVI) and CAR data to support your request for Garantia-Safra, Pronaf credit, or Emergency Reports."
                : "Exporte o histórico de vegetação do Copernicus (NDVI) e os dados do CAR para embasar sua solicitação de Garantia-Safra, crédito Pronaf ou Laudo de Engenharia."}
          </p>

          <button
            type="button"
            onClick={() => {
              setReportType("public");
              setReportProgram(undefined);
              setReportOpen(true);
            }}
            className="mt-1 h-11 w-full rounded-xl bg-primary hover:opacity-90 text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all cursor-pointer shadow-soft"
          >
            {language === "es"
              ? "Generar evidencia para programa público"
              : language === "en"
                ? "Generate evidence for public program"
                : "Gerar evidência para programa público"}
            <ArrowRight size={14} />
          </button>
        </div>

        {/* PASSO 0: Documento para validação */}
        <div className="rounded-2xl bg-card p-4 shadow-card border-2 border-dashed border-border/60">
          <h3 className="font-bold text-sm text-foreground flex items-center gap-1.5 justify-between">
            <span>
              {language === "es"
                ? "Situación Ambiental (CAR)"
                : language === "en"
                  ? "Environmental Status (CAR)"
                  : "Situação Ambiental (CAR)"}
            </span>
            <span
              className={`text-sm font-bold px-2 py-0.5 rounded ${
                documentoEstaValido
                  ? "text-primary bg-primary/10"
                  : "text-amber-warn bg-amber-warn/10"
              }`}
            >
              {documentoEstaValido
                ? language === "es"
                  ? "Concluido"
                  : language === "en"
                    ? "Completed"
                    : "Concluido"
                : language === "es"
                  ? "Pendiente"
                  : language === "en"
                    ? "Pending"
                    : "Pendente"}
            </span>
          </h3>
          <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
            {documentoEstaValido
              ? language === "es"
                ? "Su CAR fue analizado con éxito, vea abajo los programas disponibles."
                : language === "en"
                  ? "Your CAR was successfully reviewed. See the available programs below."
                  : "Seu CAR foi analisado com sucesso e está em conformidade, veja abaixo os programas disponíveis."
              : language === "es"
                  ? "Realice el Diagnóstico de su CAR para desbloquear los programas."
                  : language === "en"
                    ? "Run your CAR Diagnostics to unlock programs."
                    : "Realize o Diagnóstico do seu CAR para destravar os programas."}
          </p>

          {!documentoEstaValido && (
            <a
              href="/diagnostico"
              className="mt-3 h-10 w-full rounded-xl bg-navy text-navy-foreground font-semibold text-sm flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-soft"
            >
              {language === "es"
                ? "Realizar Diagnóstico"
                : language === "en"
                  ? "Run Diagnostics"
                  : "Realizar Diagnóstico"}
            </a>
          )}
        </div>

        {/* CARD 1: Pronaf Custeio */}
        <article className="rounded-2xl bg-card p-4 shadow-card border border-border/60">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-soft flex items-center justify-center shrink-0">
              <Landmark size={18} className="text-navy" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-base">{t("programs.pronaf_title")}</h3>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-sm font-semibold bg-primary/10 text-primary">
                  <CheckCircle2 size={11} /> {t("programs.badge_eligible")}
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5 leading-snug">
                {t("programs.pronaf_subtitle")}
              </p>
            </div>
          </div>

          <div className="mt-3 rounded-xl bg-soft px-3 py-2 text-sm text-foreground/80">
            <span className="font-semibold">{t("programs.benefit_label")}</span>{" "}
            {t("programs.pronaf_benefit")}
          </div>

          <ul className="mt-3 flex flex-col gap-1.5">
            <li className="flex items-start gap-2 text-sm">
              <CheckCircle2 size={14} className="text-primary mt-0.5 shrink-0" />
              <span className="text-foreground/80">{t("programs.pronaf_req1")}</span>
            </li>
            <li className="flex items-start gap-2 text-sm">
              <CheckCircle2 size={14} className="text-primary mt-0.5 shrink-0" />
              <span className="text-foreground/80">{t("programs.pronaf_req2")}</span>
            </li>
            <li className="flex items-start gap-2 text-sm">
              <CheckCircle2 size={14} className="text-primary mt-0.5 shrink-0" />
              <span className="text-foreground/80">{t("programs.pronaf_req3")}</span>
            </li>
          </ul>

          {documentoEstaValido && isEligible.pronaf ? (
            <button
              onClick={() => {
                setSelectedProgram("Pronaf");
                setWhatsappSent(false);
              }}
              className="mt-4 w-full h-11 rounded-xl bg-navy text-navy-foreground font-semibold text-sm flex items-center justify-center gap-1.5 active:scale-[0.99] transition-transform cursor-pointer"
            >
              {t("programs.btn_help_prepare")} <ArrowRight size={14} />
            </button>
          ) : (
            <button
              disabled
              className="mt-4 w-full h-11 rounded-xl bg-muted text-muted-foreground font-semibold text-sm flex items-center justify-center gap-1.5 opacity-60 cursor-not-allowed border border-border/40"
            >
              <Lock size={12} />{" "}
              {isEligible.pronaf
                ? t("programs_custom.locked_action") || "Ação bloqueada"
                : language === "es"
                  ? "No elegible al programa"
                  : language === "en"
                    ? "Not eligible for this program"
                    : "Não elegível ao programa"}
            </button>
          )}
        </article>

        {/* CARD 2: Garantía-Zafra */}
        <article className="rounded-2xl bg-card p-4 shadow-card border border-border/60 bg-muted/30">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-soft flex items-center justify-center shrink-0">
              <ShieldCheck size={18} className="text-muted-foreground" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-base">{t("programs.garantia_title")}</h3>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-sm font-semibold bg-destructive/10 text-destructive">
                  <AlertCircle size={11} /> {t("programs.badge_ineligible")}
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5 leading-snug">
                {t("programs.garantia_subtitle")}
              </p>
            </div>
          </div>

          <div className="mt-3 rounded-xl bg-soft px-3 py-2 text-sm text-foreground/80">
            <span className="font-semibold">{t("programs.benefit_label")}</span>{" "}
            {t("programs.garantia_benefit")}
          </div>

          <div className="mt-3 p-3 rounded-xl bg-destructive/5 border border-destructive/10 flex flex-col gap-1.5">
            <span className="text-sm font-bold text-destructive">
              {t("programs.garantia_why_ineligible_title")}
            </span>
            <div className="flex items-start gap-2 text-sm text-foreground/80">
              <span>{t("programs.garantia_why_ineligible_area")}</span>
            </div>
            <div className="flex items-start gap-2 text-sm text-foreground/80">
              <span>{t("programs.garantia_why_ineligible_location")}</span>
            </div>
          </div>

          <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
            {t("programs.garantia_ineligible_exp")}
          </p>

          {documentoEstaValido && isEligible.garantia ? (
            <button
              type="button"
              onClick={() => {
                setSelectedProgram("Garantia");
                setWhatsappSent(false);
              }}
              className="mt-3 w-full h-11 rounded-xl bg-navy text-navy-foreground font-semibold text-sm flex items-center justify-center gap-1.5 active:scale-[0.99] transition-transform cursor-pointer"
            >
              {language === "es"
                ? "Ayudar a preparar"
                : language === "en"
                  ? "Help prepare"
                  : "Ajudar a preparar"}{" "}
              <ArrowRight size={14} />
            </button>
          ) : (
            <button
              disabled
              className="mt-3 w-full h-11 rounded-xl bg-muted text-muted-foreground font-semibold text-sm flex items-center justify-center gap-1.5 opacity-60 cursor-not-allowed border border-border/40"
            >
              <Lock size={12} />{" "}
              {isEligible.garantia
                ? t("programs_custom.locked_action") || "Ação bloqueada"
                : language === "es"
                  ? "No elegible al programa"
                  : language === "en"
                    ? "Not eligible for this program"
                    : "Não elegível ao programa"}
            </button>
          )}
        </article>

        {/* Disclaimer footer */}
        <p className="text-sm text-muted-foreground mt-2 leading-relaxed text-center px-4">
          {t("programs.disclaimer")}
        </p>
      </div>

      {/* Modal/Drawer de Documentos */}
      {selectedProgram && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end justify-center">
          <div className="bg-background w-full max-w-[390px] rounded-t-3xl p-5 flex flex-col gap-4 animate-in slide-in-from-bottom duration-300 max-h-[85vh]">
            <header className="flex justify-between items-center border-b border-border pb-3 shrink-0">
              <h3 className="font-bold text-base text-foreground">
                Documentos:{" "}
                {selectedProgram === "Pronaf"
                  ? t("programs.pronaf_title")
                  : selectedProgram === "Proagro"
                    ? t("programs.proagro_title")
                    : t("programs.psr_title")}
              </h3>
              <button
                onClick={() => {
                  setSelectedProgram(null);
                  setWhatsappSent(false);
                }}
                className="text-sm text-muted-foreground hover:underline cursor-pointer"
              >
                {language === "es" ? "Cerrar" : language === "en" ? "Close" : "Fechar"}
              </button>
            </header>

            <div className="flex-1 overflow-y-auto flex flex-col gap-4 py-2 text-sm leading-relaxed">
              <p className="font-semibold text-foreground">
                {language === "es"
                  ? "Lista de documentos necesarios para el programa:"
                  : language === "en"
                    ? "List of required documents for the program:"
                    : "Lista de documentos necessários para o enquadramento:"}
              </p>
              <ul className="flex flex-col gap-2.5">
                {selectedProgram === "Pronaf" && (
                  <>
                    <li className="flex gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />{" "}
                      <span>
                        <strong>CAF/DAP:</strong>{" "}
                        {language === "es"
                          ? "Registro Nacional de Agricultura Familiar activo."
                          : language === "en"
                            ? "Active National Registry of Family Farming."
                            : "Cadastro Nacional da Agricultura Familiar ativo."}
                      </span>
                    </li>
                    <li className="flex gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />{" "}
                      <span>
                        <strong>CAR:</strong>{" "}
                        {language === "es"
                          ? "Recibo de inscripción del Cadastro Ambiental Rural activo."
                          : language === "en"
                            ? "Active Rural Environmental Registry receipt."
                            : "Recibo de inscrição do Cadastro Ambiental Rural ativo."}
                      </span>
                    </li>
                  </>
                )}
                {/* Aqui poderiam ir mais detalhes sobre os outros programas, mantido enxuto pro MVP */}
              </ul>

              <button
                type="button"
                onClick={() => {
                  setReportType("public");
                  setReportProgram(
                    selectedProgram === "Pronaf"
                      ? "Pronaf"
                      : selectedProgram === "Proagro"
                        ? "Proagro Más"
                        : selectedProgram === "Garantia"
                          ? "Garantia-Safra"
                          : "PSR",
                  );
                  setReportOpen(true);
                }}
                className="mt-2 h-11 w-full rounded-xl border border-primary text-primary hover:bg-primary/5 font-bold text-sm flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
              >
                <FileText size={14} />
                {language === "es"
                  ? "Generar evidencia para programa público"
                  : language === "en"
                    ? "Generate evidence for public program"
                    : "Gerar evidência para programa público"}
              </button>

              {whatsappSent ? (
                <div className="mt-4 p-3 bg-primary/10 text-primary border border-primary/20 rounded-xl text-center font-medium animate-in fade-in duration-200">
                  💬{" "}
                  {language === "es"
                    ? "¡Checklist enviado a tu WhatsApp!"
                    : language === "en"
                      ? "Checklist sent to your WhatsApp!"
                      : "Checklist enviado para seu WhatsApp!"}
                </div>
              ) : (
                <button
                  onClick={() => {
                    setWhatsappSent(true);
                    setPushNotification(true);
                    setTimeout(() => setPushNotification(false), 8000);
                  }}
                  disabled={!documentoEstaValido}
                  className="mt-4 h-12 w-full rounded-xl bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-soft cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {language === "es"
                    ? "Enviar lista por WhatsApp"
                    : language === "en"
                      ? "Send checklist via WhatsApp"
                      : "Enviar checklist por WhatsApp"}
                </button>
              )}

              {!documentoEstaValido && (
                <p className="text-sm text-destructive font-medium mt-2 text-center">
                  {language === "es"
                    ? "Solo puedes enviar mensajes cuando tu CAR este valido."
                    : language === "en"
                      ? "You can only send messages when your CAR is verified."
                      : "Você só pode enviar mensagens quando seu CAR estiver válido."}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
      <TechnicalReportModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        type={reportType}
        programName={reportProgram}
      />
    </MobileFrame>
  );
}
