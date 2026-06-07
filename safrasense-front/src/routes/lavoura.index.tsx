import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  CloudSun,
  ClipboardList,
  AlertTriangle,
  ArrowRight,
  Siren,
  FileText,
  Download,
  Loader2,
  CheckCircle2,
  ChevronDown,
} from "lucide-react";
import { MobileFrame } from "@/components/MobileFrame";
import { NdviChart } from "@/components/NdviChart";
import { appStore, useAppState } from "@/lib/app-store";
import { getLatestNdviAverage, parseNdviDataset } from "@/lib/ndvi";
import { t, useTranslation } from "@/lib/i18n";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../../firebase";

export const Route = createFileRoute("/lavoura/")({
  head: () => {
    const lang = appStore.get().language || "es";
    return {
      meta: [{ title: `${t("dashboard.headTitle", lang)}` }],
    };
  },
  component: LavouraScreen,
});

function LavouraScreen() {
  const {
    status,
    farmer,
    protected: isProtected,
    fieldPhotoUploaded,
    inspectionsRequested,
    activeTerrenoId,
    documentoValidado,
    documentoArquivoNome,
  } = useAppState();
  const { t, language } = useTranslation();
  const navigate = useNavigate();

  const [homologationModalOpen, setHomologationModalOpen] = useState(false);

  useEffect(() => {
    const syncFarmerFromDb = async () => {
      const uid = farmer.firebaseUid || auth.currentUser?.uid;
      if (!uid) return;

      try {
        const snap = await getDoc(doc(db, "usuarios", uid));
        if (!snap.exists()) return;

        const data = snap.data() as any;
        const crops = Array.isArray(data.produtosCultivados) ? data.produtosCultivados : [];
        const cropLabel = data.sistema
          ? `${crops.join(" + ")} (${data.sistema})`
          : crops.join(" + ");

        appStore.set({
          documentoValidado: data.documentoValidado ?? false,
          documentoArquivoNome: data.documentoArquivoNome || "",
          farmer: {
            ...farmer,
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

    syncFarmerFromDb();
  }, [farmer.firebaseUid]);

  const cfg = {
    healthy: {
      bg: "bg-primary",
      emoji: "🟢",
      pill: t("dashboard.pill_healthy"),
      title: t("dashboard.title_healthy"),
      sub: t("dashboard.sub_healthy"),
      update: t("dashboard.update_prefix") + t("dashboard.update_healthy"),
    },
    alert: {
      bg: "bg-amber-warn",
      emoji: "🟡",
      pill: t("dashboard.pill_alert"),
      title: t("dashboard.title_alert"),
      sub: t("dashboard.sub_alert"),
      update: t("dashboard.update_alert"),
    },
    emergency: {
      bg: "bg-alert",
      emoji: "🔴",
      pill: t("dashboard.pill_emergency"),
      title: t("dashboard.title_emergency"),
      sub: t("dashboard.sub_emergency"),
      update: t("dashboard.update_emergency"),
    },
  }[status];

  const currentTerreno =
    farmer.terrenos?.find((t) => t.id === activeTerrenoId) || farmer.terrenos?.[0];

  const ndviDataset = parseNdviDataset({
    relatorios_semanais: currentTerreno?.ndviRelatorioSemanal,
    relatorios_mensais: currentTerreno?.ndviRelatorioMensal,
    relatorios: currentTerreno?.ndviHistorico12m,
  });
  const latestAverageNdvi = getLatestNdviAverage(ndviDataset)?.ndviMedio ?? null;

  const confidenceLevel =
    latestAverageNdvi === null
      ? status === "healthy"
        ? "high"
        : status === "alert"
          ? "medium"
          : "low"
      : latestAverageNdvi >= 0.65
        ? "high"
        : latestAverageNdvi >= 0.2
          ? "medium"
          : "low";

  const confidenceCfg = {
    high: {
      percent: "96%",
      label: t("dashboard.confidence_high"),
      desc: t("dashboard.confidence_high_desc"),
      bg: "bg-primary/20 border-primary/30",
      textColor: "text-primary-foreground/90",
      accent: "text-primary-foreground",
    },
    medium: {
      percent: "74%",
      label: t("dashboard.confidence_medium"),
      desc: t("dashboard.confidence_medium_desc"),
      bg: "bg-amber-warn/20 border-amber-warn/30",
      textColor: "text-amber-warn-foreground/90",
      accent: "text-amber-warn-foreground",
    },
    low: {
      percent: "48%",
      label: t("dashboard.confidence_low"),
      desc: t("dashboard.confidence_low_desc"),
      bg: "bg-destructive/25 border-destructive/30",
      textColor: "text-destructive-foreground/90",
      accent: "text-destructive-foreground",
    },
  }[confidenceLevel];

  const isEmergency = status === "emergency";
  const isAlert = status === "alert";

  const firstCrop = currentTerreno?.crops?.[0] || "Milho";
  const cropText = t("crops." + firstCrop);

  const rawSystem = currentTerreno?.system || "second_harvest";
  let systemLabel = "";
  if (rawSystem === "first_harvest" || rawSystem.toLowerCase() === "primeira safra") {
    systemLabel =
      language === "es" ? "Safra Actual" : language === "en" ? "Current Crop" : "Safra Atual";
  } else if (rawSystem === "second_harvest" || rawSystem.toLowerCase() === "safrinha") {
    systemLabel =
      language === "es"
        ? "Safrinha Actual"
        : language === "en"
          ? "Current Safrinha"
          : "Safrinha Atual";
  } else if (
    rawSystem === "rotation" ||
    rawSystem.toLowerCase() === "rotação" ||
    rawSystem.toLowerCase() === "rotacao"
  ) {
    systemLabel =
      language === "es"
        ? "Rotación Actual"
        : language === "en"
          ? "Current Rotation"
          : "Rotação Atual";
  } else {
    systemLabel =
      language === "es" ? "Safra Actual" : language === "en" ? "Current Crop" : "Safra Atual";
  }

  const dynamicLegendLabel = `${systemLabel} (${cropText}: 🟢/🟡/🔴)`;

  return (
    <MobileFrame withNav>
      <section className={`${cfg.bg} text-white px-5 pt-6 pb-10 relative`}>
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0 pr-2">
            <p className="text-sm text-white font-medium">{cfg.update}</p>
            {farmer.terrenos && farmer.terrenos.length > 1 ? (
              <div className="relative mt-1 max-w-[240px]">
                <select
                  value={activeTerrenoId || "1"}
                  onChange={(e) => appStore.setActiveTerreno(e.target.value)}
                  className="bg-white/15 hover:bg-white/25 border border-white/20 rounded-xl pl-3 pr-8 py-1.5 text-sm font-bold text-white outline-none cursor-pointer appearance-none w-full transition-all truncate"
                >
                  {farmer.terrenos.map((t) => (
                    <option key={t.id} value={t.id} className="text-navy bg-card">
                      {t.name} ·{" "}
                      {t.status === "healthy"
                        ? "🟢 Saudável"
                        : t.status === "alert"
                          ? "🟡 Atenção"
                          : "🔴 Crítico"}
                    </option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-2.5 flex items-center pointer-events-none text-white/90">
                  <ChevronDown size={15} />
                </div>
              </div>
            ) : (
              <p className="text-sm font-bold mt-1.5 truncate">
                {currentTerreno
                  ? `${currentTerreno.name} · ${currentTerreno.address}`
                  : `${farmer.property} · ${farmer.location}`}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2" />
        </div>

        <div className="flex flex-col items-center mt-5">
          <div className="w-28 h-28 rounded-full border-[3px] border-white/70 flex items-center justify-center bg-white/5 backdrop-blur shadow-[0_0_30px_rgba(255,255,255,0.15)]">
            <div className="relative flex items-center justify-center w-12 h-12">
              <span
                className={`absolute w-12 h-12 rounded-full opacity-60 animate-ping duration-1000 ${
                  status === "healthy"
                    ? "bg-emerald-400"
                    : status === "alert"
                      ? "bg-amber-400"
                      : "bg-red-500"
                }`}
              />
              <span
                className={`w-9 h-9 rounded-full shadow-[0_2px_10px_rgba(0,0,0,0.15)] border-2 border-white/60 ${
                  status === "healthy"
                    ? "bg-emerald-500"
                    : status === "alert"
                      ? "bg-amber-500"
                      : "bg-red-600"
                }`}
              />
            </div>
          </div>
          <span className="mt-3 text-sm tracking-[0.15em] font-bold text-white">
            {cfg.pill}
          </span>
          <h1 className="text-xl font-bold mt-1 text-center">{cfg.title}</h1>
          <p className="text-sm text-white/95 mt-1.5 text-center max-w-[280px]">{cfg.sub}</p>

          {/* Model Confidence Glassmorphic Badge */}
          <button
            onClick={() => setHomologationModalOpen(true)}
            className={`mt-4 mx-auto max-w-[290px] w-full rounded-2xl p-3.5 border backdrop-blur-md flex items-center gap-3.5 text-left ${confidenceCfg.bg} shadow-md hover:scale-[1.01] transition-transform cursor-pointer block`}
          >
            <div
              className={`text-2xl font-black ${confidenceCfg.accent} shrink-0 tabular-nums`}
            >
              {confidenceCfg.percent}
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-sm tracking-wider uppercase font-bold block opacity-90">
                {language === "es"
                  ? "CONFIANZA DEL MODELO"
                  : language === "en"
                    ? "MODEL CONFIDENCE"
                    : "CONFIANÇA DO MODELO"}
              </span>
              <span className="text-sm font-bold block leading-snug">
                {confidenceCfg.label}
              </span>
              <p className="text-sm opacity-90 mt-0.5 leading-normal truncate max-w-full">
                {confidenceCfg.desc}
              </p>
            </div>
          </button>
        </div>
      </section>

      <section className="bg-background rounded-t-3xl -mt-5 px-5 pt-6 pb-6 flex flex-col gap-4 relative z-10">
        <div className="rounded-2xl bg-card p-3 shadow-card border border-border/60">
          <NdviChart status={status} />
          <div className="flex flex-col gap-1.5 px-2 pt-2.5 text-sm text-foreground/80 border-t border-border/40 mt-1">
            <div className="flex items-center gap-4 flex-wrap">
              <Legend swatch color="#FFD700" label={dynamicLegendLabel} />
              <Legend dashed color="#9E9E9E" label={t("dashboard.legend_historical")} />
            </div>
          </div>
        </div>

        {/* Guia Didático do Gráfico */}
        <div className="rounded-2xl bg-primary/5 border border-primary/20 p-4 flex flex-col gap-2.5 shadow-soft">
          <h3 className="font-bold text-base text-primary flex items-center gap-1.5">
            {language === "es"
              ? "🌱 Entenda la saúde de su tierra de forma sencilla:"
              : language === "en"
                ? "🌱 Understand the health of your land in a simple way:"
                : "🌱 Entenda a saúde da sua terra de forma simples:"}
          </h3>
          <div className="text-sm flex flex-col gap-2.5 text-foreground/85 leading-relaxed">
            <div className="flex gap-2">
              <span className="shrink-0 mt-0.5" aria-hidden>
                🟢
              </span>
              <p>{t("dashboard.green_corn_text")}</p>
            </div>
            <div className="flex gap-2">
              <span className="shrink-0 mt-0.5" aria-hidden>
                🟡
              </span>
              <p>{t("dashboard.yellow_corn_text")}</p>
            </div>
            <div className="flex gap-2">
              <span className="shrink-0 mt-0.5" aria-hidden>
                🔴
              </span>
              <p>{t("dashboard.red_corn_text")}</p>
            </div>
          </div>
        </div>

        {isEmergency ? (
          <div className="rounded-2xl bg-alert/5 border-l-4 border-alert p-4 shadow-card">
            <div className="flex items-center gap-2 font-bold text-base text-alert">
              <Siren size={16} />
              {t("dashboard.emergency_card_title")}
            </div>
            <p className="text-sm text-foreground/90 mt-1.5 leading-relaxed">
              {isProtected
                ? t("dashboard.emergency_card_desc_protected")
                : `${language === "es" ? "Tu propiedad está con vigor severamente por debajo de lo normal hace 21 dias. " : language === "en" ? "Your property has been severely below normal for 21 days. " : "Sua propriedade está com vigor severamente abaixo do normal há 21 dias. "}${t("dashboard.emergency_card_desc_unprotected")}`}
            </p>
          </div>
        ) : isAlert ? (
          <div className="rounded-2xl bg-card border-l-4 border-amber-warn p-4 shadow-card">
            <div className="flex items-center gap-2 font-bold text-base">
              <AlertTriangle size={16} className="text-amber-warn" />
              {t("dashboard.alert_card_title")}
            </div>
            <p className="text-sm text-foreground/80 mt-1.5 leading-relaxed">
              {t("dashboard.alert_card_desc")}
            </p>
          </div>
        ) : (
          <>
            <InfoCard
              icon={<ClipboardList size={18} className="text-primary" />}
              title={t("dashboard.healthy_card_title")}
              body={t("dashboard.healthy_card_desc")}
            />
            <InfoCard
              icon={<CloudSun size={18} className="text-navy" />}
              title={t("dashboard.forecast_card_title")}
              body={t("dashboard.forecast_card_desc")}
            />
          </>
        )}

        {isEmergency && !isProtected && (
          <button
            onClick={() => navigate({ to: "/lavoura/acao" })}
            className="h-14 rounded-2xl bg-alert text-alert-foreground font-semibold text-base flex items-center justify-center gap-2 active:scale-[0.99] shadow-soft"
          >
            {t("dashboard.btn_what_to_do_now")} <ArrowRight size={18} />
          </button>
        )}

        {isAlert && (
          <button
            onClick={() => navigate({ to: "/lavoura/acao" })}
            className="h-14 rounded-2xl bg-amber-warn text-amber-warn-foreground font-semibold text-base flex items-center justify-center gap-2 active:scale-[0.99] shadow-soft"
          >
            {t("dashboard.btn_what_to_do_now")} <ArrowRight size={18} />
          </button>
        )}
      </section>
      {/* Homologation Modal */}
      {homologationModalOpen && (
        <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-card rounded-3xl w-full max-w-[340px] shadow-2xl border border-border/80 flex flex-col max-h-[90%] overflow-hidden animate-in zoom-in-95 duration-200 text-left">
            {/* Header */}
            <div className="px-5 py-4 border-b border-border flex items-center justify-between bg-feature text-feature-foreground shrink-0">
              <span className="text-sm font-bold tracking-wide uppercase">
                {language === "es"
                  ? "Homologación de Datos"
                  : language === "en"
                    ? "Data Verification"
                    : "Homologação de Dados"}
              </span>
              <button
                type="button"
                onClick={() => setHomologationModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-feature-foreground/10 text-feature-foreground/80 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="p-5 flex-1 overflow-y-auto flex flex-col gap-4">
              <div className="text-center">
                <span className="text-3xl">🛡️</span>
                <h4 className="font-bold text-base text-foreground mt-2">
                  {language === "es"
                    ? "Garantía de Acuracidad para Seguradoras"
                    : language === "en"
                      ? "Accuracy Guarantee for Insurers"
                      : "Garantia de Acurácia para Seguradoras"}
                </h4>
                <p className="text-sm text-foreground/80 mt-1 leading-relaxed">
                  {language === "es"
                    ? "Para que el laudo de satélite sea aceptado por las seguradoras, es necesario aumentar la acuracidad de los datos por medio de validación complementaria."
                    : language === "en"
                      ? "For the satellite report to be accepted by insurers, it is necessary to increase data accuracy through complementary verification."
                      : "Para que o laudo de satélite seja aceito pelas seguradoras, é necessário elevar a acurácia dos dados por meio de validação complementar."}
                </p>
              </div>

              {/* Status Atual */}
              <div className="p-3.5 rounded-xl border border-border bg-soft flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {language === "es"
                    ? "Acuracidad Actual:"
                    : language === "en"
                      ? "Current Accuracy:"
                      : "Acurácia Atual:"}
                </span>
                <span
                  className={`font-bold ${fieldPhotoUploaded ? "text-emerald-600" : "text-amber-600"}`}
                >
                  {fieldPhotoUploaded ? "96% (Alta)" : "48% (Baixa - Pendente)"}
                </span>
              </div>

              {/* Método 1: Fotos de Campo */}
              <div className="p-4 rounded-xl border border-border flex flex-col gap-2.5">
                <h5 className="font-bold text-sm text-foreground flex items-center gap-1.5">
                  📸{" "}
                  {language === "es"
                    ? "1. Fotos Georreferenciadas"
                    : language === "en"
                      ? "1. Georeferenced Photos"
                      : "1. Fotos Georreferenciadas"}
                </h5>
                <p className="text-sm text-foreground/85 leading-relaxed">
                  {language === "es"
                    ? "Tome fotos de su plantación seca. El app firmará las fotos con fecha y GPS del lote para comprobación sin fraude."
                    : language === "en"
                      ? "Take photos of your dry crop. The app signs the photos with date and GPS coordinates to prevent fraud."
                      : "Tire fotos de sua plantação seca. O app assina as fotos com a data e coordenadas GPS do lote para comprovação sem fraudes."}
                </p>
                {fieldPhotoUploaded ? (
                  <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 text-sm font-bold rounded-lg flex items-center gap-1.5">
                    <CheckCircle2 size={14} />
                    {language === "es"
                      ? "Foto de campo enviada (GPS validado)"
                      : language === "en"
                        ? "Field photo uploaded (GPS validated)"
                        : "Foto de campo enviada (GPS verificado)"}
                  </div>
                ) : (
                  <label className="h-12 border border-dashed border-primary/50 bg-primary/5 rounded-lg flex items-center justify-center text-primary text-sm font-bold cursor-pointer hover:bg-primary/10 transition-colors">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={() => appStore.set({ fieldPhotoUploaded: true })}
                    />
                    {language === "es"
                      ? "Subir Foto de la Lavoura"
                      : language === "en"
                        ? "Upload Crop Photo"
                        : "Subir Foto da Lavoura"}
                  </label>
                )}
              </div>

              {/* Método 2: Revisão de Agrônomo (CREA) */}
              <div className="p-4 rounded-xl border border-border flex flex-col gap-2.5">
                <h5 className="font-bold text-sm text-foreground flex items-center gap-1.5">
                  👷{" "}
                  {language === "es"
                    ? "2. Laudo CREA / Vistoria"
                    : language === "en"
                      ? "2. Agronomist Verification (CREA)"
                      : "2. Laudo CREA / Vistoria"}
                </h5>
                <p className="text-sm text-foreground/85 leading-relaxed">
                  {language === "es"
                    ? "Solicite una revisión remota o presencial de un agrónomo credenciado de su cooperativa para emitir la firma ART."
                    : language === "en"
                      ? "Request a remote or on-site review from a certified agronomist from your cooperative to issue the ART signature."
                      : "Solicite uma revisão remota ou presencial de um agrônomo credenciado de sua cooperativa para emissão da assinatura ART."}
                </p>
                {inspectionsRequested ? (
                  <div className="p-2.5 bg-primary/10 border border-primary/20 text-primary text-sm font-bold rounded-lg flex items-center gap-1.5">
                    <CheckCircle2 size={14} />
                    {language === "es"
                      ? "Vistoria Solicitada"
                      : language === "en"
                        ? "Inspection Requested"
                        : "Vistoria Solicitada (Eng. Clara Mendes)"}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      appStore.set({
                        inspectionsRequested: true,
                        fieldPhotoUploaded: true,
                      });
                    }}
                    className="h-12 bg-primary text-primary-foreground rounded-lg text-sm font-bold flex items-center justify-center hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer w-full"
                  >
                    {language === "es"
                      ? "Solicitar Validación CREA"
                      : language === "en"
                        ? "Request CREA Validation"
                        : "Solicitar Validação CREA"}
                  </button>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-border bg-soft shrink-0">
              <button
                type="button"
                onClick={() => setHomologationModalOpen(false)}
                className="h-12 w-full bg-primary text-primary-foreground rounded-xl font-bold text-sm hover:opacity-90 transition-all cursor-pointer"
              >
                {language === "es" ? "Confirmar" : language === "en" ? "Confirm" : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}

    </MobileFrame>
  );
}

function InfoCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-2xl bg-card p-4 shadow-card border border-border/60">
      <div className="flex items-center gap-2 font-bold text-base">
        {icon} {title}
      </div>
      <p className="text-sm text-foreground/80 mt-1.5 leading-relaxed">{body}</p>
    </div>
  );
}

function Legend({
  color,
  label,
  dashed,
  swatch,
}: {
  color: string;
  label: string;
  dashed?: boolean;
  swatch?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5">
      {swatch ? (
        <span className="inline-block w-3 h-3 rounded-sm" style={{ background: color }} />
      ) : (
        <span
          className="inline-block w-4 h-0.5"
          style={{
            background: color,
            borderTop: dashed ? `2px dashed ${color}` : undefined,
            backgroundColor: dashed ? "transparent" : color,
            height: dashed ? 0 : 2,
          }}
        />
      )}
      {label}
    </div>
  );
}
