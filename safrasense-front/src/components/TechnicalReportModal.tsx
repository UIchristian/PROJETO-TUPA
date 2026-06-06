import { useState, useEffect } from "react";
import {
  FileText,
  Download,
  Share2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  X,
  Loader2,
  ArrowLeft,
} from "lucide-react";
import { useAppState, appStore } from "@/lib/app-store";
import { useTranslation, translateCropString } from "@/lib/i18n";
import { NdviChart } from "./NdviChart";

interface TechnicalReportModalProps {
  open: boolean;
  onClose: () => void;
  type: "public" | "insurance";
  programName?: string;
}

const reportTranslations = {
  es: {
    title: "Informe Técnico Satelital — Evidencia de Riesgo Climático",
    issued: "Emisión",
    data_source:
      "Datos: Copernicus (Sentinel-2 / Copernicus Land Monitoring Service) — datos oficiales del programa de la Unión Europea y la Agencia Espacial Europea (ESA)",

    sec1_title: "I. Identificación de la Propiedad",
    sec1_farmer: "Productor Declarado",
    sec1_car: "Número del CAR",
    sec1_location: "Municipio / Estado",
    sec1_coords: "Coordenadas / Polígono",
    sec1_area: "Área Evaluada",
    sec1_crop: "Cultivo Declarado",

    sec2_title: "II. Período Analizado",
    sec2_window: "Ventana de monitoreo",
    sec2_window_val: "Últimos 6 meses (dic/2025 a may/2026)",
    sec2_recent: "Fecha de la imagen más reciente",
    sec2_recent_val: "22 de mayo de 2026",

    sec3_title: "III. Estado Actual de la Tierra",
    sec3_ndvi: "Índice de vigor de la vegetación (NDVI/FAPAR) actual",
    sec3_class: "Clasificación visual",
    sec3_comp: "Comparación con el promedio histórico",
    sec3_status_healthy: "Saludable",
    sec3_status_alert: "Atención",
    sec3_status_emergency: "Crisis",
    sec3_comp_healthy: "Dentro del promedio histórico (+2%)",
    sec3_comp_alert: "Por debajo del promedio histórico (-12%)",
    sec3_comp_emergency: "Déficit crítico severo (-24%)",

    sec4_title: "IV. Serie Histórica",
    sec4_param_ref: "Índice paramétrico de referencia: 0.72. Umbral de activación: 0.50.",
    sec4_table_period: "Período (Mês)",
    sec4_table_current: "NDVI Actual",
    sec4_table_historical: "Promedio esperado",
    sec4_table_dev: "Desviación",
    sec4_table_status: "Estado",

    sec5_title: "V. Evento Climático Detectado",
    sec5_desc:
      "Detectado déficit de vigor de {pct}% por debajo del promedio histórico, entre {start} y {end}, compatible con evento de sequía / estrés hídrico.",
    sec5_pct_alert: "12%",
    sec5_pct_emergency: "24%",
    sec5_start: "marzo de 2026",
    sec5_end: "mayo de 2026",
    sec5_severity: "Severidad",
    sec5_sev_healthy: "Ninguna",
    sec5_sev_alert: "Moderada",
    sec5_sev_emergency: "Grave",
    sec5_confidence: "Confianza del análisis (model confidence)",
    sec5_conf_high: "Alta (96% de precisión de pixel)",
    sec5_conf_medium: "Media (74% de precisión de pixel)",
    sec5_conf_low: "Baja (48% de precisión de pixel)",
    sec5_conf_warning: "⚠️ Este resultado requiere revisión humana antes de cualquier acción.",
    sec5_compatible: "Compatible con los criterios de pérdida del programa {program}.",

    sec6_title: "VI. Verificación de Consistencia",
    sec6_car_valid: "CAR validado contra base pública",
    sec6_poly_valid: "Polígono compatible con la ubicación",
    sec6_sat_valid: "Uso agrícola confirmado por satélite",
    sec6_yes: "Sí",
    sec6_no: "No",
    sec6_note:
      "Esta verificación confirma la consistencia del inmueble y su uso. No constituye comprobación de titularidad, que se realiza por separado.",

    sec7_title: "VII. Finalidad y Reservas",
    sec7_purpose:
      "Este informe sirve como evidencia técnica complementaria para solicitar acceso a programas públicos de protección rural o para cotización de seguro paramétrico.",
    sec7_warning:
      "Este informe no sustituye el peritaje oficial del programa o de la aseguradora. Es una evidencia técnica de apoyo basada en datos satelitales públicos.",

    next_steps_title: "Próximos Pasos",
    next_steps_public_1: "1. Lleva este informe a {institution}.",
    next_steps_public_2: "2. Adjunta tu CAF y documentos personales.",
    next_steps_public_3:
      "3. El informe acelera el análisis, pero la decisión final es del órgano responsable del programa.",
    next_steps_insurance_1:
      "1. Comparte este informe con la aseguradora aliada al solicitar cotización.",
    next_steps_insurance_2:
      "2. El histórico satelital permite a la aseguradora evaluar el perfil de riesgo de tu propiedad.",
    next_steps_insurance_3:
      "3. La contratación y las condiciones son definidas por la aseguradora autorizada.",

    footer_tag: "Generado por SafraSense sobre infraestructura Copernicus / ESA",
    demo_badge: "Ejemplo ilustrativo",
    btn_export: "Exportar PDF",
    btn_share: "Compartir",
    btn_back: "Volver",
    toast_pdf_exporting: "Generando PDF...",
    toast_pdf_success: "¡PDF exportado con éxito!",
    toast_share_success: "¡Evidencias compartidas!",
  },
  pt: {
    title: "Relatório Técnico Satelital — Evidência de Risco Climático",
    issued: "Emissão",
    data_source:
      "Dados: Copernicus (Sentinel-2 / Copernicus Land Monitoring Service) — dados oficiais do programa da União Europeia e da Agência Espacial Europeia (ESA)",

    sec1_title: "I. Identificação da Propriedade",
    sec1_farmer: "Produtor Declarado",
    sec1_car: "Número do CAR",
    sec1_location: "Município / Estado",
    sec1_coords: "Coordenadas / Polígono",
    sec1_area: "Área Avaliada",
    sec1_crop: "Cultivo Declarado",

    sec2_title: "II. Período Analisado",
    sec2_window: "Janela de monitoramento",
    sec2_window_val: "Últimos 6 meses (dez/2025 a mai/2026)",
    sec2_recent: "Data da imagem mais recente",
    sec2_recent_val: "22 de maio de 2026",

    sec3_title: "III. Estado Atual da Terra",
    sec3_ndvi: "Índice de vigor da vegetação (NDVI/FAPAR) atual",
    sec3_class: "Classificação visual",
    sec3_comp: "Comparação com a média histórica",
    sec3_status_healthy: "Saudável",
    sec3_status_alert: "Atenção",
    sec3_status_emergency: "Crise",
    sec3_comp_healthy: "Dentro da média histórica (+2%)",
    sec3_comp_alert: "Abaixo da média histórica (-12%)",
    sec3_comp_emergency: "Déficit crítico severo (-24%)",

    sec4_title: "IV. Série Histórica",
    sec4_param_ref: "Índice paramétrico de referência: 0.72. Limiar de ativação: 0.50.",
    sec4_table_period: "Período (Mês)",
    sec4_table_current: "NDVI Atual",
    sec4_table_historical: "Média esperada",
    sec4_table_dev: "Desvio",
    sec4_table_status: "Classificação",

    sec5_title: "V. Evento Climático Detectado",
    sec5_desc:
      "Detectado déficit de vigor de {pct}% abaixo da média histórica, entre {start} e {end}, compatível com evento de seca / estresse hídrico.",
    sec5_pct_alert: "12%",
    sec5_pct_emergency: "24%",
    sec5_start: "março de 2026",
    sec5_end: "maio de 2026",
    sec5_severity: "Severidade",
    sec5_sev_healthy: "Nenhuma",
    sec5_sev_alert: "Moderada",
    sec5_sev_emergency: "Grave",
    sec5_confidence: "Confiança da análise (model confidence)",
    sec5_conf_high: "Alta (96% de precisão de pixel)",
    sec5_conf_medium: "Média (74% de precisão de pixel)",
    sec5_conf_low: "Baixa (48% de precisão de pixel)",
    sec5_conf_warning: "⚠️ Este resultado requer verificação humana antes de qualquer ação.",
    sec5_compatible: "Compatível com os critérios de perda do programa {program}.",

    sec6_title: "VI. Verificação de Consistência",
    sec6_car_valid: "CAR validado contra base pública",
    sec6_poly_valid: "Polígono compatível com a localização",
    sec6_sat_valid: "Uso agrícola confirmado por satélite",
    sec6_yes: "Sim",
    sec6_no: "Não",
    sec6_note:
      "Esta verificação confirma a consistência do imóvel e seu uso. Não constitui comprovação de titularidade, que é realizada separadamente.",

    sec7_title: "VII. Finalidade e Reservas",
    sec7_purpose:
      "Este relatório serve como evidência técnica complementar para solicitar acesso a programas públicos de proteção rural ou para cotação de seguro paramétrico.",
    sec7_warning:
      "Este relatório não substitui a perícia oficial do programa ou da seguradora. É uma evidência técnica de apoio baseada em dados satelitais públicos.",

    next_steps_title: "Próximos Passos",
    next_steps_public_1: "1. Leve este relatório para {institution}.",
    next_steps_public_2: "2. Anexe sua CAF e documentos pessoais.",
    next_steps_public_3:
      "3. O relatório acelera a análise, mas a decisão final é do órgão responsável pelo programa.",
    next_steps_insurance_1:
      "1. Compartilhe este relatório com a seguradora parceira ao solicitar cotação.",
    next_steps_insurance_2:
      "2. O histórico satelital permite à seguradora avaliar o perfil de risco da sua propriedade.",
    next_steps_insurance_3:
      "3. A contratação e as condições são definidas pela seguradora autorizada.",

    footer_tag: "Gerado por SafraSense sobre infraestrutura Copernicus / ESA",
    demo_badge: "Exemplo ilustrativo",
    btn_export: "Exportar PDF",
    btn_share: "Compartilhar",
    btn_back: "Voltar",
    toast_pdf_exporting: "Gerando PDF...",
    toast_pdf_success: "PDF exportado com sucesso!",
    toast_share_success: "Evidências compartilhadas!",
  },
  en: {
    title: "Satellite Technical Report — Climate Risk Evidence",
    issued: "Issued",
    data_source:
      "Data: Copernicus (Sentinel-2 / Copernicus Land Monitoring Service) — official data from the European Union and European Space Agency (ESA) program",

    sec1_title: "I. Property Identification",
    sec1_farmer: "Declared Producer",
    sec1_car: "CAR Number",
    sec1_location: "Municipality / State",
    sec1_coords: "Coordinates / Polygon",
    sec1_area: "Evaluated Area",
    sec1_crop: "Declared Crop",

    sec2_title: "II. Monitored Period",
    sec2_window: "Monitoring window",
    sec2_window_val: "Last 6 months (Dec/2025 to May/2026)",
    sec2_recent: "Most recent image date",
    sec2_recent_val: "May 22, 2026",

    sec3_title: "III. Land Current Status",
    sec3_ndvi: "Current vegetation vigor index (NDVI/FAPAR)",
    sec3_class: "Visual classification",
    sec3_comp: "Comparison with regional historical average",
    sec3_status_healthy: "Healthy",
    sec3_status_alert: "Attention",
    sec3_status_emergency: "Crisis",
    sec3_comp_healthy: "Within historical average (+2%)",
    sec3_comp_alert: "Below historical average (-12%)",
    sec3_comp_emergency: "Critical severe deficit (-24%)",

    sec4_title: "IV. Historical Series",
    sec4_param_ref: "Reference parametric index: 0.72. Activation threshold: 0.50.",
    sec4_table_period: "Period (Month)",
    sec4_table_current: "Current NDVI",
    sec4_table_historical: "Expected average",
    sec4_table_dev: "Deviation",
    sec4_table_status: "Classification",

    sec5_title: "V. Detected Climate Event",
    sec5_desc:
      "Vigor deficit of {pct}% below historical average detected between {start} and {end}, compatible with drought / water stress event.",
    sec5_pct_alert: "12%",
    sec5_pct_emergency: "24%",
    sec5_start: "March 2026",
    sec5_end: "May 2026",
    sec5_severity: "Severity",
    sec5_sev_healthy: "None",
    sec5_sev_alert: "Moderate",
    sec5_sev_emergency: "Severe",
    sec5_confidence: "Analysis confidence (model confidence)",
    sec5_conf_high: "High (96% pixel accuracy)",
    sec5_conf_medium: "Medium (74% pixel accuracy)",
    sec5_conf_low: "Low (48% pixel accuracy)",
    sec5_conf_warning: "⚠️ This result requires human verification before any action.",
    sec5_compatible: "Compatible with the loss criteria of program {program}.",

    sec6_title: "VI. Consistency Verification",
    sec6_car_valid: "CAR validated against public database",
    sec6_poly_valid: "Polygon compatible with location",
    sec6_sat_valid: "Agricultural use confirmed by satellite",
    sec6_yes: "Yes",
    sec6_no: "No",
    sec6_note:
      "This verification confirms property and usage consistency. It does not constitute proof of ownership, which is conducted separately.",

    sec7_title: "VII. Purpose and Disclaimer",
    sec7_purpose:
      "This report serves as supporting technical evidence to request access to public rural protection programs or for parametric insurance quoting.",
    sec7_warning:
      "This report does not replace the official appraisal of the program or the insurer. It is supporting technical evidence based on public satellite data.",

    next_steps_title: "Next Steps",
    next_steps_public_1: "1. Take this report to {institution}.",
    next_steps_public_2: "2. Attach your CAF and personal documents.",
    next_steps_public_3:
      "3. The report speeds up the analysis, but final decision is made by the program's responsible body.",
    next_steps_insurance_1:
      "1. Share this report with the partner insurer when requesting a quote.",
    next_steps_insurance_2:
      "2. The satellite history allows the insurer to assess the risk profile of your property.",
    next_steps_insurance_3:
      "3. Contract sign-up and conditions are defined by the authorized insurer.",

    footer_tag: "Generated by SafraSense on Copernicus / ESA infrastructure",
    demo_badge: "Illustrative example",
    btn_export: "Export PDF",
    btn_share: "Share",
    btn_back: "Back",
    toast_pdf_exporting: "Generating PDF...",
    toast_pdf_success: "PDF exported successfully!",
    toast_share_success: "Evidence shared successfully!",
  },
} as const;

export function TechnicalReportModal({
  open,
  onClose,
  type,
  programName,
}: TechnicalReportModalProps) {
  const { farmer, status, fieldPhotoUploaded } = useAppState();
  const { language, t: globalT } = useTranslation();

  const [exporting, setExporting] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const lang = language === "en" ? "en" : language === "pt" ? "pt" : "es";
  const rt = reportTranslations[lang];

  // Auto-close toast
  useEffect(() => {
    if (successToast) {
      const tId = setTimeout(() => setSuccessToast(null), 3000);
      return () => clearTimeout(tId);
    }
  }, [successToast]);

  if (!open) return null;

  // Determine actual values based on state status
  let currentNdvi = 0.32;
  let devText = rt.sec3_comp_emergency;
  let visualClass = rt.sec3_status_emergency;
  let textClassColor = "text-red-600 bg-red-50 dark:bg-red-950/20";
  let statusEmoji = "🔴";

  if (status === "healthy") {
    currentNdvi = 0.72;
    devText = rt.sec3_comp_healthy;
    visualClass = rt.sec3_status_healthy;
    textClassColor = "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20";
    statusEmoji = "🟢";
  } else if (status === "alert") {
    currentNdvi = 0.54;
    devText = rt.sec3_comp_alert;
    visualClass = rt.sec3_status_alert;
    textClassColor = "text-amber-600 bg-amber-50 dark:bg-amber-950/20";
    statusEmoji = "🟡";
  }

  // Model Confidence determination
  let confidenceLevel = rt.sec5_conf_low;
  let isLowConfidence = true;
  if (status === "healthy") {
    confidenceLevel = rt.sec5_conf_high;
    isLowConfidence = false;
  } else if (status === "alert") {
    confidenceLevel = rt.sec5_conf_medium;
    isLowConfidence = false;
  } else if (status === "emergency" && fieldPhotoUploaded) {
    confidenceLevel = rt.sec5_conf_high;
    isLowConfidence = false;
  }

  // Historical data values mapped for table
  const monthsData = [
    {
      period:
        lang === "es" ? "Diciembre / 2025" : lang === "pt" ? "Dezembro / 2025" : "December / 2025",
      current: 0.67,
      historical: 0.68,
      status: rt.sec3_status_healthy,
      color: "text-emerald-600",
    },
    {
      period: lang === "es" ? "Enero / 2026" : lang === "pt" ? "Janeiro / 2026" : "January / 2026",
      current: 0.7,
      historical: 0.7,
      status: rt.sec3_status_healthy,
      color: "text-emerald-600",
    },
    {
      period:
        lang === "es" ? "Febrero / 2026" : lang === "pt" ? "Fevereiro / 2026" : "February / 2026",
      current: 0.68,
      historical: 0.72,
      status: rt.sec3_status_healthy,
      color: "text-emerald-600",
    },
    {
      period: lang === "es" ? "Marzo / 2026" : lang === "pt" ? "Março / 2026" : "March / 2026",
      current: status === "healthy" ? 0.73 : status === "alert" ? 0.66 : 0.58,
      historical: 0.74,
      status:
        status === "healthy" || status === "alert" ? rt.sec3_status_healthy : rt.sec3_status_alert,
      color: status === "healthy" || status === "alert" ? "text-emerald-600" : "text-amber-600",
    },
    {
      period: lang === "es" ? "Abril / 2026" : lang === "pt" ? "Abril / 2026" : "April / 2026",
      current: status === "healthy" ? 0.74 : status === "alert" ? 0.6 : 0.46,
      historical: 0.73,
      status:
        status === "healthy"
          ? rt.sec3_status_healthy
          : status === "alert"
            ? rt.sec3_status_alert
            : rt.sec3_status_emergency,
      color:
        status === "healthy"
          ? "text-emerald-600"
          : status === "alert"
            ? "text-amber-600"
            : "text-red-600 font-bold",
    },
    {
      period: lang === "es" ? "Mayo / 2026" : lang === "pt" ? "Maio / 2026" : "May / 2026",
      current: currentNdvi,
      historical: 0.72,
      status: visualClass,
      color:
        status === "healthy"
          ? "text-emerald-600"
          : status === "alert"
            ? "text-amber-600"
            : "text-red-600 font-bold",
    },
  ];

  const handleExportPDF = () => {
    setExporting(true);
    setTimeout(() => {
      setExporting(false);
      setSuccessToast(rt.toast_pdf_success);
    }, 2000);
  };

  const handleShare = () => {
    const textMsg = `${rt.title} - ${farmer.property} (CAR: ${farmer.car || "MG-3170107-123456-78"})`;
    if (navigator.share) {
      navigator
        .share({
          title: rt.title,
          text: textMsg,
          url: window.location.href,
        })
        .catch(console.error);
    } else {
      setSuccessToast(rt.toast_share_success);
    }
  };

  // Determine institution name for gov programs
  let institution =
    lang === "es"
      ? "la institución correspondiente"
      : lang === "pt"
        ? "a instituição responsável"
        : "the responsible institution";
  if (programName === "Pronaf") {
    institution =
      lang === "es"
        ? "tu cooperativa local o banco financiador"
        : lang === "pt"
          ? "sua cooperativa local ou banco financiador"
          : "your local cooperative or bank";
  } else if (programName === "Garantia-Safra" || programName === "Garantia") {
    institution =
      lang === "es"
        ? "la oficina de Emater o secretaría de agricultura"
        : lang === "pt"
          ? "o escritório da Emater ou secretaria de agricultura"
          : "the Emater office or agricultural department";
  } else if (programName === "Proagro" || programName === "Proagro Más") {
    institution =
      lang === "es"
        ? "la sucursal de tu banco financiador"
        : lang === "pt"
          ? "a agência do seu banco financiador"
          : "your financing bank branch";
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-0 sm:p-4 overflow-y-auto">
      {/* Toast Notification */}
      {successToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white rounded-xl px-4 py-2.5 shadow-xl text-[12px] font-bold flex items-center gap-1.5 animate-in fade-in slide-in-from-top-4 duration-300">
          <CheckCircle2 size={14} className="text-emerald-400" />
          {successToast}
        </div>
      )}

      <div className="bg-slate-100 dark:bg-slate-900 w-full max-w-[390px] h-full sm:h-[92vh] sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-border">
        {/* Document Viewer Header Bar */}
        <div className="bg-slate-900 text-white px-4 py-3 flex.items-center justify-between flex shrink-0 border-b border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1 text-slate-400 hover:text-white transition-colors cursor-pointer text-[12px] font-semibold"
          >
            <ArrowLeft size={16} />
            {rt.btn_back}
          </button>
          <span className="text-[11px] font-extrabold tracking-wider uppercase text-slate-400">
            {type === "public" ? "POLÍTICA PÚBLICA" : "SEGURO PARAMÉTRICO"}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable A4 Document Container */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 bg-slate-200/50 dark:bg-slate-950/20 text-slate-800">
          {/* Document Sheet simulating A4 Paper */}
          <div className="bg-white dark:bg-slate-900 shadow-md rounded-2xl border border-slate-300/80 dark:border-slate-800 p-4 sm:p-5 flex flex-col gap-4 text-left relative overflow-hidden">
            {/* Demo Watermark Ribbon */}
            <div className="absolute top-3 -right-12 bg-amber-500 text-white font-extrabold text-[8px] uppercase py-1 px-12 rotate-45 tracking-widest shadow-sm select-none z-20 pointer-events-none flex items-center justify-center">
              {rt.demo_badge}
            </div>

            {/* Cabeçalho */}
            <header className="border-b border-slate-200 dark:border-slate-800 pb-3 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg overflow-hidden bg-emerald-600 p-1 flex items-center justify-center shrink-0">
                    <img
                      src="/logo.png"
                      alt="SafraSense"
                      className="w-full h-full object-cover rounded-md"
                    />
                  </div>
                  <div>
                    <span className="font-extrabold text-[13px] text-slate-900 dark:text-white tracking-tight block">
                      SafraSense
                    </span>
                    <span className="text-[8px] text-slate-400 block -mt-0.5">
                      Copernicus Telemetry Node
                    </span>
                  </div>
                </div>
                <div className="text-right text-[8.5px] font-mono text-slate-500">
                  <div className="font-bold text-slate-800 dark:text-slate-200">
                    REF: SS-2026-0001
                  </div>
                  <div>
                    {rt.issued}: {new Date().toLocaleDateString(lang === "pt" ? "pt-BR" : "es-ES")}
                  </div>
                </div>
              </div>

              <h1 className="text-[13px] font-extrabold text-slate-900 dark:text-white uppercase tracking-tight leading-snug mt-1.5">
                {rt.title}
              </h1>

              <p className="text-[7.5px] text-slate-400 leading-tight italic">{rt.data_source}</p>
            </header>

            {/* Seção 1 — Identificación */}
            <section className="flex flex-col gap-1.5">
              <h2 className="text-[9.5px] font-extrabold uppercase tracking-wider text-emerald-800 dark:text-emerald-400 border-b border-slate-100 dark:border-slate-800 pb-0.5">
                {rt.sec1_title}
              </h2>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[9.5px] text-slate-600 dark:text-slate-400">
                <div>
                  <span className="text-[7.5px] uppercase font-bold text-slate-400 block">
                    {rt.sec1_farmer}
                  </span>
                  <span className="font-bold text-slate-900 dark:text-slate-200">
                    {farmer.name || "Geraldo Dias"}
                  </span>
                </div>
                <div>
                  <span className="text-[7.5px] uppercase font-bold text-slate-400 block">
                    {rt.sec1_car}
                  </span>
                  <span className="font-mono font-bold text-slate-900 dark:text-slate-200">
                    {farmer.car || "MG-3170107-123456-78"}
                  </span>
                </div>
                <div>
                  <span className="text-[7.5px] uppercase font-bold text-slate-400 block">
                    {rt.sec1_location}
                  </span>
                  <span className="font-bold text-slate-900 dark:text-slate-200">
                    {farmer.location.includes("Minas Gerais")
                      ? farmer.location
                      : `${farmer.location}, Minas Gerais, Brasil`}
                  </span>
                </div>
                <div>
                  <span className="text-[7.5px] uppercase font-bold text-slate-400 block">
                    {rt.sec1_coords}
                  </span>
                  <span className="font-mono font-medium text-slate-900 dark:text-slate-200">
                    Lat: -16.3572, Lon: -46.9061
                  </span>
                </div>
                <div>
                  <span className="text-[7.5px] uppercase font-bold text-slate-400 block">
                    {rt.sec1_area}
                  </span>
                  <span className="font-bold text-slate-900 dark:text-slate-200">
                    {farmer.area} ha
                  </span>
                </div>
                <div>
                  <span className="text-[7.5px] uppercase font-bold text-slate-400 block">
                    {rt.sec1_crop}
                  </span>
                  <span className="font-bold text-slate-900 dark:text-slate-200">
                    {translateCropString(farmer.crop, globalT)}
                  </span>
                </div>
              </div>
            </section>

            {/* Seção 2 — Período analizado */}
            <section className="flex flex-col gap-1.5">
              <h2 className="text-[9.5px] font-extrabold uppercase tracking-wider text-emerald-800 dark:text-emerald-400 border-b border-slate-100 dark:border-slate-800 pb-0.5">
                {rt.sec2_title}
              </h2>
              <div className="grid grid-cols-2 gap-3 text-[9.5px] text-slate-600 dark:text-slate-400">
                <div>
                  <span className="text-[7.5px] uppercase font-bold text-slate-400 block">
                    {rt.sec2_window}
                  </span>
                  <span className="font-medium text-slate-900 dark:text-slate-200">
                    {rt.sec2_window_val}
                  </span>
                </div>
                <div>
                  <span className="text-[7.5px] uppercase font-bold text-slate-400 block">
                    {rt.sec2_recent}
                  </span>
                  <span className="font-medium text-slate-900 dark:text-slate-200">
                    {rt.sec2_recent_val}
                  </span>
                </div>
              </div>
            </section>

            {/* Seção 3 — Estado actual de la tierra */}
            <section className="flex flex-col gap-1.5">
              <h2 className="text-[9.5px] font-extrabold uppercase tracking-wider text-emerald-800 dark:text-emerald-400 border-b border-slate-100 dark:border-slate-800 pb-0.5">
                {rt.sec3_title}
              </h2>
              <div className="flex flex-col gap-2 text-[9.5px] text-slate-600 dark:text-slate-400">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1">
                  <span>{rt.sec3_ndvi}:</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-slate-200">
                    {currentNdvi}{" "}
                    <span className="text-[7.5px] font-semibold text-amber-600 font-sans">
                      ({rt.demo_badge})
                    </span>
                  </span>
                </div>
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1">
                  <span>{rt.sec3_class}:</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[8.5px] font-extrabold flex items-center gap-1 ${textClassColor}`}
                  >
                    <span>{statusEmoji}</span> {visualClass}
                  </span>
                </div>
                <div className="flex items-center justify-between pb-0.5">
                  <span>{rt.sec3_comp}:</span>
                  <span className="font-bold text-slate-900 dark:text-slate-200">{devText}</span>
                </div>
              </div>
            </section>

            {/* Seção 4 — Serie histórica */}
            <section
              className={`flex flex-col gap-2 rounded-xl p-2.5 transition-all ${
                type === "insurance"
                  ? "bg-blue-500/5 dark:bg-blue-500/10 border-2 border-blue-500/30"
                  : "border border-slate-200 dark:border-slate-800"
              }`}
            >
              <div className="flex justify-between items-center border-b border-slate-200/60 dark:border-slate-800 pb-0.5">
                <h2 className="text-[9.5px] font-extrabold uppercase tracking-wider text-emerald-800 dark:text-emerald-400">
                  {rt.sec4_title}
                </h2>
                {type === "insurance" && (
                  <span className="text-[7px] font-extrabold text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30 px-1.5 py-0.5 rounded uppercase tracking-wider">
                    {lang === "es"
                      ? "Énfasis Seguro"
                      : lang === "pt"
                        ? "Ênfase Seguro"
                        : "Insurance Focus"}
                  </span>
                )}
              </div>

              {type === "insurance" && (
                <div className="text-[8px] font-bold text-blue-800 dark:text-blue-300 leading-tight bg-blue-100/60 dark:bg-blue-900/20 p-2 rounded-lg">
                  💡 {rt.sec4_param_ref}{" "}
                  <span className="text-[7.5px] font-normal text-muted-foreground">
                    ({rt.demo_badge})
                  </span>
                </div>
              )}

              {/* NdviChart component */}
              <div className="bg-slate-50 dark:bg-slate-950/40 rounded-xl p-2 border border-slate-200/50 dark:border-slate-800/80 scale-[0.98] origin-top">
                <NdviChart status={status} />
              </div>

              {/* Table */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden mt-1.5">
                <table className="w-full text-[8.5px] text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-slate-500 uppercase text-[7px] font-bold">
                      <th className="px-2 py-1">{rt.sec4_table_period}</th>
                      <th className="px-2 py-1 text-center">{rt.sec4_table_current}</th>
                      <th className="px-2 py-1 text-center">{rt.sec4_table_historical}</th>
                      <th className="px-2 py-1 text-center">{rt.sec4_table_dev}</th>
                      <th className="px-2 py-1 text-right">{rt.sec4_table_status}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                    {monthsData.map((m, idx) => {
                      const devVal = Math.round(((m.current - m.historical) / m.historical) * 100);
                      const isNegative = devVal < 0;
                      return (
                        <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/50">
                          <td className="px-2 py-1 font-semibold">{m.period}</td>
                          <td className="px-2 py-1 text-center font-mono font-medium">
                            {m.current.toFixed(2)}
                          </td>
                          <td className="px-2 py-1 text-center font-mono text-slate-400">
                            {m.historical.toFixed(2)}
                          </td>
                          <td
                            className={`px-2 py-1 text-center font-mono font-bold ${isNegative ? "text-red-500" : "text-emerald-500"}`}
                          >
                            {devVal > 0 ? `+${devVal}` : devVal}%
                          </td>
                          <td className={`px-2 py-1 text-right font-bold text-[7.5px] ${m.color}`}>
                            {m.status}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Seção 5 — Evento climático detectado */}
            <section
              className={`flex flex-col gap-2 rounded-xl p-2.5 transition-all ${
                type === "public"
                  ? "bg-red-500/5 dark:bg-red-950/15 border-2 border-red-500/30"
                  : "border border-slate-200 dark:border-slate-800"
              }`}
            >
              <div className="flex justify-between items-center border-b border-slate-200/60 dark:border-slate-800 pb-0.5">
                <h2 className="text-[9.5px] font-extrabold uppercase tracking-wider text-emerald-800 dark:text-emerald-400">
                  {rt.sec5_title}
                </h2>
                {type === "public" && (
                  <span className="text-[7px] font-extrabold text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 px-1.5 py-0.5 rounded uppercase tracking-wider">
                    {lang === "es"
                      ? "Énfasis Gobierno"
                      : lang === "pt"
                        ? "Ênfase Governo"
                        : "Government Focus"}
                  </span>
                )}
              </div>

              <div className="text-[9.5px] text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                {status === "healthy" ? (
                  <span>
                    {lang === "es"
                      ? "No se detectaron eventos climáticos adversos en el período analizado."
                      : lang === "pt"
                        ? "Não foram detectados eventos climáticos adversos no período analisado."
                        : "No adverse climate events were detected in the analyzed period."}
                  </span>
                ) : (
                  <span>
                    {rt.sec5_desc
                      .replace(
                        "{pct}",
                        status === "alert" ? rt.sec5_pct_alert : rt.sec5_pct_emergency,
                      )
                      .replace("{start}", rt.sec5_start)
                      .replace("{end}", rt.sec5_end)}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 text-[9px] mt-1 text-slate-600 dark:text-slate-400">
                <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-1">
                  <span>{rt.sec5_severity}:</span>
                  <span className="font-bold text-slate-900 dark:text-slate-200">
                    {status === "healthy"
                      ? rt.sec5_sev_healthy
                      : status === "alert"
                        ? rt.sec5_sev_alert
                        : rt.sec5_sev_emergency}
                  </span>
                </div>
                <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-1">
                  <span>{rt.sec5_confidence}:</span>
                  <span className="font-bold text-slate-900 dark:text-slate-200">
                    {confidenceLevel}
                  </span>
                </div>
              </div>

              {isLowConfidence && (
                <div className="mt-1 text-[8.5px] font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20 p-1.5 rounded border border-red-200/50">
                  {rt.sec5_conf_warning}
                </div>
              )}

              {type === "public" && status !== "healthy" && (
                <div className="mt-1.5 text-[8.5px] font-bold text-red-700 dark:text-red-400 border-t border-red-200/30 pt-1.5 italic">
                  ✓ {rt.sec5_compatible.replace("{program}", programName || "Pronaf")}{" "}
                  <span className="text-[7px] font-normal text-muted-foreground">
                    ({rt.demo_badge})
                  </span>
                </div>
              )}
            </section>

            {/* Seção 6 — Verificación de consistencia */}
            <section className="flex flex-col gap-1.5">
              <h2 className="text-[9.5px] font-extrabold uppercase tracking-wider text-emerald-800 dark:text-emerald-400 border-b border-slate-100 dark:border-slate-800 pb-0.5">
                {rt.sec6_title}
              </h2>

              <ul className="flex flex-col gap-1 text-[9px] text-slate-700 dark:text-slate-300">
                <li className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 size={12} className="text-emerald-500" />
                    {rt.sec6_car_valid}
                  </span>
                  <span className="font-extrabold text-emerald-600 uppercase text-[8px]">
                    {rt.sec6_yes}
                  </span>
                </li>
                <li className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 size={12} className="text-emerald-500" />
                    {rt.sec6_poly_valid}
                  </span>
                  <span className="font-extrabold text-emerald-600 uppercase text-[8px]">
                    {rt.sec6_yes}
                  </span>
                </li>
                <li className="flex items-center justify-between pb-0.5">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 size={12} className="text-emerald-500" />
                    {rt.sec6_sat_valid}
                  </span>
                  <span className="font-extrabold text-emerald-600 uppercase text-[8px]">
                    {rt.sec6_yes}
                  </span>
                </li>
              </ul>

              <p className="text-[7.5px] text-slate-400 leading-snug italic mt-0.5">
                {rt.sec6_note}
              </p>
            </section>

            {/* Seção 7 — Finalidad y reservas */}
            <section className="flex flex-col gap-2">
              <h2 className="text-[9.5px] font-extrabold uppercase tracking-wider text-emerald-800 dark:text-emerald-400 border-b border-slate-100 dark:border-slate-800 pb-0.5">
                {rt.sec7_title}
              </h2>
              <p className="text-[9px] text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                {rt.sec7_purpose}
              </p>

              {/* Ressalva (Aviso Destacado) */}
              <div className="bg-amber-500/5 dark:bg-amber-500/10 border-l-4 border-amber-500 p-2.5 rounded-r-xl">
                <p className="text-[8.5px] leading-relaxed text-amber-800 dark:text-amber-300 font-semibold">
                  ⚠️{" "}
                  <strong>
                    {lang === "es"
                      ? "Aviso Importante:"
                      : lang === "pt"
                        ? "Aviso Importante:"
                        : "Important Notice:"}
                  </strong>{" "}
                  {rt.sec7_warning}
                </p>
              </div>
            </section>

            {/* Bloco Extra "Próximos passos" */}
            <section className="border-t border-slate-200 dark:border-slate-800 pt-3 flex flex-col gap-1.5 text-left">
              <h3 className="font-extrabold text-[10px] text-slate-900 dark:text-white uppercase tracking-tight">
                👉 {rt.next_steps_title}
              </h3>
              <ul className="flex flex-col gap-1 text-[9px] text-slate-600 dark:text-slate-400 leading-snug">
                {type === "public" ? (
                  <>
                    <li>{rt.next_steps_public_1.replace("{institution}", institution)}</li>
                    <li>{rt.next_steps_public_2}</li>
                    <li>{rt.next_steps_public_3}</li>
                  </>
                ) : (
                  <>
                    <li>{rt.next_steps_insurance_1}</li>
                    <li>{rt.next_steps_insurance_2}</li>
                    <li>{rt.next_steps_insurance_3}</li>
                  </>
                )}
              </ul>
            </section>

            {/* Rodapé */}
            <footer className="border-t border-slate-200 dark:border-slate-800 pt-2.5 mt-2 flex flex-col gap-1 text-center text-[7.5px] text-slate-400">
              <div>{rt.footer_tag}</div>
              <div className="font-mono">
                SHA-256: 8f9b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b · v2.4.1-copernicus
              </div>
            </footer>
          </div>
        </div>

        {/* Document Viewer Action Footer */}
        <div className="bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-4 py-3.5 flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            disabled={exporting}
            onClick={handleExportPDF}
            className="flex-1 h-11 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-200 text-white dark:text-slate-900 rounded-xl font-bold text-[12.5px] flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all disabled:opacity-60 cursor-pointer"
          >
            {exporting ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                {rt.toast_pdf_exporting}
              </>
            ) : (
              <>
                <Download size={14} />
                {rt.btn_export}
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleShare}
            className="h-11 px-4 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl font-bold text-[12.5px] flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all cursor-pointer"
          >
            <Share2 size={14} />
            <span className="hidden xs:inline">{rt.btn_share}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="h-11 px-4 text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl font-bold text-[12.5px] transition-colors cursor-pointer"
          >
            {rt.btn_back}
          </button>
        </div>
      </div>
    </div>
  );
}
