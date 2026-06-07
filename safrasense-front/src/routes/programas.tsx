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
  Pencil,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { MobileFrame } from "@/components/MobileFrame";
import { useAppState, appStore } from "@/lib/app-store";
import { t, useTranslation } from "@/lib/i18n";
import { TechnicalReportModal } from "@/components/TechnicalReportModal";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { deleteObject, ref } from "firebase/storage";
import { auth, db, storage } from "../../firebase";

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
  // documentoValidado and documentoArquivoNome are read from the store (reactive + persisted in
  // localStorage) so they are available immediately on mount without waiting for Firestore.
  const { farmer, documentoValidado = false, documentoArquivoNome = "" } = useAppState();
  const { t, language } = useTranslation();
  const [selectedProgram, setSelectedProgram] = useState<string | null>(null);
  const [whatsappSent, setWhatsappSent] = useState(false);
  const [pushNotification, setPushNotification] = useState(false);
  const [documentoStoragePath, setDocumentoStoragePath] = useState("");
  const [documentoMotivoRejeicao, setDocumentoMotivoRejeicao] = useState("");
  const [deletingDoc, setDeletingDoc] = useState(false);
  const [confirmDeleteDoc, setConfirmDeleteDoc] = useState(false);

  const [reportOpen, setReportOpen] = useState(false);
  const [reportType, setReportType] = useState<"public" | "insurance">("public");
  const [reportProgram, setReportProgram] = useState<string | undefined>(undefined);

  const documentoEstaValido =
    documentoValidado === true ||
    documentoValidado === "valido" ||
    documentoValidado === "validado";
  const documentoPendente = documentoValidado === "pendente";
  const documentoRejeitado = documentoValidado === false && !!documentoArquivoNome;

  // Eligibility map for current POC rules.
  // Non-eligible programs must remain blocked even with validated documents.
  const isEligible = {
    pronaf: true,
    garantia: false,
    proagro: true,
    psr: true,
  };

  useEffect(() => {
    const loadData = async (uid: string) => {
      try {
        const snap = await getDoc(doc(db, "usuarios", uid));
        if (!snap.exists()) return;

        const data = snap.data() as any;
        setDocumentoStoragePath(data.documentoStoragePath || "");
        setDocumentoMotivoRejeicao(data.documentoMotivoRejeicao || "");

        const crops = Array.isArray(data.produtosCultivados) ? data.produtosCultivados : [];
        const cropLabel = data.sistema
          ? `${crops.join(" + ")} (${data.sistema})`
          : crops.join(" + ");

        // Update the store so documentoValidado and documentoArquivoNome are reactive
        appStore.set({
          documentoValidado: data.documentoValidado ?? false,
          documentoArquivoNome: data.documentoArquivoNome || "",
          farmer: {
            ...appStore.get().farmer,
            firebaseUid: uid,
            name: data.nome || farmer.name,
            cpf: data.cpf || farmer.cpf,
            phone: data.telefone || farmer.phone,
            property: data.nomePropriedade || data.regiaoMapa || farmer.property,
            location: data.enderecoInformado || farmer.location,
            area: Number(data.hectares || farmer.area),
            crop: cropLabel || farmer.crop,
            car: data.numeroCAR || farmer.car,
            avatar: data.avatar || farmer.avatar,
            terrenos: data.terrenos || farmer.terrenos,
          },
        });
      } catch (error) {
        console.error(error);
      }
    };

    // Load immediately if uid is already known (from store / localStorage)
    const storedUid = farmer.firebaseUid;
    if (storedUid) loadData(storedUid);

    // Also subscribe to auth state in case the uid wasn't ready on mount
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user && user.uid !== storedUid) loadData(user.uid);
    });

    return () => unsubscribe();
  }, []);

  const handleDeleteDocument = async () => {
    const uid = farmer.firebaseUid || auth.currentUser?.uid || "";
    if (!uid) return;
    setDeletingDoc(true);
    try {
      if (documentoStoragePath) {
        await deleteObject(ref(storage, documentoStoragePath)).catch(() => {});
      }
      await setDoc(
        doc(db, "usuarios", uid),
        {
          documentoValidado: false,
          documentoArquivoNome: "",
          documentoArquivoTipo: "",
          documentoStoragePath: "",
          documentoDownloadURL: "",
          documentoMotivoRejeicao: "",
          documentoEnviadoEm: null,
          atualizadoEm: serverTimestamp(),
        },
        { merge: true },
      );
      appStore.set({ documentoValidado: false, documentoArquivoNome: "" });
      setDocumentoStoragePath("");
      setDocumentoMotivoRejeicao("");
      setConfirmDeleteDoc(false);
    } catch (err) {
      console.error(err);
    } finally {
      setDeletingDoc(false);
    }
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
              <strong>SafraSense:</strong>{" "}
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
        <h1 className="text-xl font-bold">{t("programs.title").split(" — ")[0]}</h1>
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

        {/* PASSO 0 — Documento para validação */}
        <div className="rounded-2xl bg-card p-4 shadow-card border-2 border-dashed border-border/60">
          <h3 className="font-bold text-sm text-foreground flex items-center gap-1.5 justify-between">
            <span>
              {language === "es"
                ? "Enviar documento para validación"
                : language === "en"
                  ? "Send document for validation"
                  : "Enviar documento para validacao"}
            </span>
            <span
              className={`text-sm font-bold px-2 py-0.5 rounded ${
                documentoEstaValido
                  ? "text-primary bg-primary/10"
                  : documentoPendente
                    ? "text-amber-warn bg-amber-warn/10"
                    : documentoRejeitado
                      ? "text-destructive bg-destructive/10"
                      : "text-muted-foreground bg-muted"
              }`}
            >
              {documentoEstaValido
                ? language === "es" ? "Concluido" : language === "en" ? "Completed" : "Concluido"
                : documentoPendente
                  ? language === "es" ? "Pendiente" : language === "en" ? "Pending" : "Aguardando aprovação"
                  : documentoRejeitado
                    ? language === "es" ? "Rechazado" : language === "en" ? "Rejected" : "Não aprovado"
                    : language === "es" ? "No enviado" : language === "en" ? "Not sent" : "Nao enviado"}
            </span>
          </h3>
          <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
            {documentoEstaValido
              ? language === "es"
                ? "Su documento fue analizado con éxito, vea abajo los programas disponibles."
                : language === "en"
                  ? "Your document was successfully reviewed. See the available programs below."
                  : "Seu documento foi analisado com sucesso, veja abaixo os programas disponíveis."
              : documentoPendente
                ? language === "es"
                  ? "Documento recibido y en análisis. Te notificaremos en breve."
                  : language === "en"
                    ? "Document received and under review. You will be notified soon."
                    : "Seu arquivo foi recebido e está em análise pela equipe SafraSense. Você será notificado em breve."
                : documentoRejeitado
                  ? language === "es"
                    ? "Su documento no fue aprobado. Envíe un nuevo documento para continuar."
                    : language === "en"
                      ? "Your document was not approved. Please send a new document to continue."
                      : "Seu documento não foi aprovado. Envie um novo arquivo para continuar."
                  : language === "es"
                    ? "Adjunte un documento para revisión. Mientras el estado sea no enviado o pendiente, la etapa no se considera concluida."
                    : language === "en"
                      ? "Attach a document for review. While status is not sent or pending, this step is not completed."
                      : "Anexe um documento para revisao. Enquanto o status estiver nao enviado ou pendente, essa etapa nao fica concluida."}
          </p>

          {(documentoPendente || documentoRejeitado) && documentoArquivoNome && (
            <div className="mt-3 rounded-xl border border-border bg-soft/60 p-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-card border border-border flex items-center justify-center shrink-0">
                  <FileText size={16} className={documentoPendente ? "text-amber-warn" : "text-destructive"} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground truncate">{documentoArquivoNome}</p>
                  <p className={`text-xs mt-0.5 font-medium ${documentoPendente ? "text-amber-warn" : "text-destructive"}`}>
                    {documentoPendente
                      ? language === "es" ? "⏳ En análisis" : language === "en" ? "⏳ Under review" : "⏳ Aguardando aprovação"
                      : language === "es" ? "✕ Não aprovado" : language === "en" ? "✕ Not approved" : "✕ Não aprovado"}
                  </p>
                </div>
              </div>

              {!confirmDeleteDoc ? (
                <div className="flex gap-2 mt-2.5">
                  <a
                    href="/comprovar?redirect=%2Fprogramas"
                    className="flex-1 h-8 rounded-lg border border-border bg-card text-foreground text-xs font-semibold flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                  >
                    <Pencil size={12} />
                    {language === "es" ? "Sustituir" : language === "en" ? "Replace" : "Substituir"}
                  </a>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteDoc(true)}
                    className="flex-1 h-8 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-xs font-semibold flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
                  >
                    <Trash2 size={12} />
                    {language === "es" ? "Eliminar" : language === "en" ? "Delete" : "Remover"}
                  </button>
                </div>
              ) : (
                <div className="mt-2.5 rounded-lg bg-destructive/10 border border-destructive/20 p-2.5 flex flex-col gap-2">
                  <p className="text-xs font-bold text-destructive text-center">
                    {language === "es" ? "¿Confirmar eliminación?" : language === "en" ? "Confirm deletion?" : "Confirmar remoção do arquivo?"}
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteDoc(false)}
                      className="flex-1 h-8 rounded-lg border border-border bg-card text-foreground text-xs font-semibold active:scale-95 cursor-pointer"
                    >
                      {language === "es" ? "Cancelar" : language === "en" ? "Cancel" : "Cancelar"}
                    </button>
                    <button
                      type="button"
                      onClick={handleDeleteDocument}
                      disabled={deletingDoc}
                      className="flex-1 h-8 rounded-lg bg-destructive text-white text-xs font-semibold disabled:opacity-60 active:scale-95 cursor-pointer"
                    >
                      {deletingDoc ? "..." : language === "es" ? "Confirmar" : language === "en" ? "Confirm" : "Confirmar"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {documentoRejeitado && (
            <div className="mt-3 rounded-xl bg-destructive/10 border border-destructive/20 px-3 py-2.5">
              <p className="text-xs font-bold text-destructive">
                {language === "es" ? "Motivo" : language === "en" ? "Reason" : "Motivo da rejeição"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {documentoMotivoRejeicao ||
                  (language === "es"
                    ? "Sin motivo informado."
                    : language === "en"
                      ? "No reason provided."
                      : "Nenhum motivo informado.")}
              </p>
            </div>
          )}

          {(documentoRejeitado || (!documentoEstaValido && !documentoPendente)) && (
            <a
              href="/comprovar?redirect=%2Fprogramas"
              className="mt-3 h-10 w-full rounded-xl bg-navy text-navy-foreground font-semibold text-sm flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-soft"
            >
              {documentoRejeitado
                ? language === "es" ? "Enviar nuevo documento" : language === "en" ? "Send new document" : "Enviar novo documento"
                : language === "es" ? "Enviar documento en Comprobar" : language === "en" ? "Send document in Verify" : "Enviar documento em Comprovar"}
            </a>
          )}
        </div>

        {/* CARD 1 — Pronaf Custeio */}
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
              {isEligible.pronaf ? t("programs_custom.locked_action") : language === "es" ? "No elegible al programa" : language === "en" ? "Not eligible for this program" : "Não elegível ao programa"}
            </button>
          )}
        </article>

        {/* CARD 2 — Garantía-Zafra */}
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
                ? t("programs_custom.locked_action")
                : language === "es" ? "No elegible al programa" : language === "en" ? "Not eligible for this program" : "Não elegível ao programa"}
            </button>
          )}
        </article>

        {/* CARD 3 — Proagro Más */}
        <article className="rounded-2xl bg-card p-4 shadow-card border border-border/60">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-soft flex items-center justify-center shrink-0">
              <ShieldCheck size={18} className="text-primary" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-base">{t("programs.proagro_title")}</h3>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-sm font-semibold bg-primary/10 text-primary">
                  <CheckCircle2 size={11} /> {t("programs.badge_conditional")}
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5 leading-snug">
                {t("programs.proagro_subtitle")}
              </p>
            </div>
          </div>

          <div className="mt-3 rounded-xl bg-soft px-3 py-2 text-sm text-foreground/80">
            <span className="font-semibold">{t("programs.benefit_label")}</span>{" "}
            {t("programs.proagro_benefit")}
          </div>

          <ul className="mt-3 flex flex-col gap-1.5">
            <li className="flex items-start gap-2 text-sm">
              <CheckCircle2 size={14} className="text-primary mt-0.5 shrink-0" />
              <span className="text-foreground/80">{t("programs.proagro_req1")}</span>
            </li>
            <li className="flex items-start gap-2 text-sm">
              <CheckCircle2 size={14} className="text-primary mt-0.5 shrink-0" />
              <span className="text-foreground/80">{t("programs.proagro_req2")}</span>
            </li>
            <li className="flex items-start gap-2 text-sm">
              <CheckCircle2 size={14} className="text-primary mt-0.5 shrink-0" />
              <span className="text-foreground/80">{t("programs.proagro_req3")}</span>
            </li>
            <li className="flex items-start gap-2 text-sm">
              <CheckCircle2 size={14} className="text-primary mt-0.5 shrink-0" />
              <span className="text-foreground/80">{t("programs.proagro_req4")}</span>
            </li>
          </ul>

          <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
            {t("programs.proagro_exp")}
          </p>

          {documentoEstaValido && isEligible.proagro ? (
            <button
              onClick={() => {
                setSelectedProgram("Proagro");
                setWhatsappSent(false);
              }}
              className="mt-3 w-full h-11 rounded-xl bg-navy text-navy-foreground font-semibold text-sm flex items-center justify-center gap-1.5 active:scale-[0.99] transition-transform cursor-pointer"
            >
              {t("programs.btn_help_prepare")} <ArrowRight size={14} />
            </button>
          ) : (
            <button
              disabled
              className="mt-3 w-full h-11 rounded-xl bg-muted text-muted-foreground font-semibold text-sm flex items-center justify-center gap-1.5 opacity-60 cursor-not-allowed border border-border/40"
            >
              <Lock size={12} />{" "}
              {isEligible.proagro ? t("programs_custom.locked_action") : language === "es" ? "No elegible al programa" : language === "en" ? "Not eligible for this program" : "Não elegível ao programa"}
            </button>
          )}
        </article>

        {/* CARD 4 — PSR */}
        <article className="rounded-2xl bg-card p-4 shadow-card border border-border/60">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-soft flex items-center justify-center shrink-0">
              <Sprout size={18} className="text-primary" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-base">{t("programs.psr_title")}</h3>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-sm font-semibold bg-primary/10 text-primary">
                  <CheckCircle2 size={11} /> {t("programs.badge_eligible")}
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5 leading-snug">
                {t("programs.psr_subtitle")}
              </p>
            </div>
          </div>

          <div className="mt-3 rounded-xl bg-soft px-3 py-2 text-sm text-foreground/80">
            <span className="font-semibold">{t("programs.benefit_label")}</span>{" "}
            {t("programs.psr_benefit")}
          </div>

          <ul className="mt-3 flex flex-col gap-1.5">
            <li className="flex items-start gap-2 text-sm">
              <CheckCircle2 size={14} className="text-primary mt-0.5 shrink-0" />
              <span className="text-foreground/80">{t("programs.psr_req1")}</span>
            </li>
            <li className="flex items-start gap-2 text-sm">
              <CheckCircle2 size={14} className="text-primary mt-0.5 shrink-0" />
              <span className="text-foreground/80">{t("programs.psr_req2")}</span>
            </li>
            <li className="flex items-start gap-2 text-sm">
              <CheckCircle2 size={14} className="text-primary mt-0.5 shrink-0" />
              <span className="text-foreground/80">{t("programs.psr_req3")}</span>
            </li>
          </ul>

          <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
            {t("programs.psr_exp")}
          </p>

          {documentoEstaValido && isEligible.psr ? (
            <button
              onClick={() => {
                setSelectedProgram("PSR");
                setWhatsappSent(false);
              }}
              className="mt-3 w-full h-11 rounded-xl bg-navy text-navy-foreground font-semibold text-sm flex items-center justify-center gap-1.5 active:scale-[0.99] transition-transform cursor-pointer"
            >
              {t("programs.btn_help_prepare")} <ArrowRight size={14} />
            </button>
          ) : (
            <button
              disabled
              className="mt-3 w-full h-11 rounded-xl bg-muted text-muted-foreground font-semibold text-sm flex items-center justify-center gap-1.5 opacity-60 cursor-not-allowed border border-border/40"
            >
              <Lock size={12} />{" "}
              {isEligible.psr ? t("programs_custom.locked_action") : language === "es" ? "No elegible al programa" : language === "en" ? "Not eligible for this program" : "Não elegível ao programa"}
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
                Documentos —{" "}
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
                        <strong>ZARC:</strong>{" "}
                        {language === "es"
                          ? "Cumplimiento del Zoneamiento de Riesgo Climático."
                          : language === "en"
                            ? "Compliance with Agricultural Climate Risk Zoning."
                            : "Cumprimento do Zoneamento Agrícola de Risco Climático."}
                      </span>
                    </li>
                    <li className="flex gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />{" "}
                      <span>
                        <strong>
                          {language === "es"
                            ? "Proyecto Técnico"
                            : language === "en"
                              ? "Technical Project"
                              : "Projeto Técnico"}
                          :
                        </strong>{" "}
                        {language === "es"
                          ? "Elaborado por un técnico agrícola acreditado."
                          : language === "en"
                            ? "Prepared by an accredited agricultural advisor."
                            : "Elaborado por um técnico agrícola credenciado."}
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
                {selectedProgram === "Proagro" && (
                  <>
                    <li className="flex gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />{" "}
                      <span>
                        <strong>
                          {language === "es"
                            ? "Contrato de Financiamiento"
                            : language === "en"
                              ? "Financing Agreement"
                              : "Contrato de Financiamento"}
                          :
                        </strong>{" "}
                        {language === "es"
                          ? "Copia de la propuesta de crédito Pronaf activa."
                          : language === "en"
                            ? "Copy of the active Pronaf credit proposal."
                            : "Cópia da proposta de enquadramento Pronaf ativa."}
                      </span>
                    </li>
                    <li className="flex gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />{" "}
                      <span>
                        <strong>ZARC:</strong>{" "}
                        {language === "es"
                          ? "Cumplimiento de la ventana de siembra recomendada."
                          : language === "en"
                            ? "Compliance with the recommended planting window."
                            : "Cumprimento da janela de plantio recomendada."}
                      </span>
                    </li>
                    <li className="flex gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />{" "}
                      <span>
                        <strong>CAR:</strong>{" "}
                        {language === "es"
                          ? "Comprobante de delimitación geográfica."
                          : language === "en"
                            ? "Proof of geographic boundaries registry."
                            : "Recibo do CAR com delimitação geográfica."}
                      </span>
                    </li>
                  </>
                )}
                {selectedProgram === "PSR" && (
                  <>
                    <li className="flex gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />{" "}
                      <span>
                        <strong>
                          {language === "es"
                            ? "Póliza/Propuesta"
                            : language === "en"
                              ? "Policy/Proposal"
                              : "Apólice/Proposta"}
                          :
                        </strong>{" "}
                        {language === "es"
                          ? "Seguro rural firmado con una aseguradora acreditada."
                          : language === "en"
                            ? "Rural insurance contract signed with an approved insurer."
                            : "Apólice de seguro rural assinada com seguradora credenciada."}
                      </span>
                    </li>
                    <li className="flex gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />{" "}
                      <span>
                        <strong>CAR:</strong>{" "}
                        {language === "es"
                          ? "Catastro en conformidad sin embargos."
                          : language === "en"
                            ? "Registry in compliance with no environmental restrictions."
                            : "Cadastro em conformidade sem pendências de embargo."}
                      </span>
                    </li>
                    <li className="flex gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />{" "}
                      <span>
                        <strong>
                          {language === "es"
                            ? "Reporte de Siembra"
                            : language === "en"
                              ? "Planting Report"
                              : "Laudo de Plantio"}
                          :
                        </strong>{" "}
                        {language === "es"
                          ? "Comprobante de siembra de la cosecha actual."
                          : language === "en"
                            ? "Proof of planting for the current harvest."
                            : "Comprovante de plantio da safra vigente."}
                      </span>
                    </li>
                  </>
                )}
                {selectedProgram === "Garantia" && (
                  <>
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
                    <li className="flex gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />{" "}
                      <span>
                        <strong>CAF/DAP:</strong>{" "}
                        {language === "es"
                          ? "Inscripción en el CAF de agricultura familiar."
                          : language === "en"
                            ? "Family Farming National Registry (CAF) enrollment."
                            : "Inscrição no CAF de agricultura familiar."}
                      </span>
                    </li>
                    <li className="flex gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />{" "}
                      <span>
                        <strong>
                          {language === "es"
                            ? "Declaración de Pérdida"
                            : language === "en"
                              ? "Loss Declaration"
                              : "Declaração de Perda"}
                          :
                        </strong>{" "}
                        {language === "es"
                          ? "Formulario de pérdidas certificado por el consejo municipal rural."
                          : language === "en"
                            ? "Loss declaration form certified by the local municipal rural council."
                            : "Formulário de laudo de perda homologado pelo conselho municipal."}
                      </span>
                    </li>
                  </>
                )}
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
                    ? "Solo puedes enviar mensajes cuando el campo documentoValidado esté como válido."
                    : language === "en"
                      ? "You can only send messages when documentoValidado is set to valid."
                      : "Voce so pode enviar mensagens quando documentoValidado estiver como valido."}
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
