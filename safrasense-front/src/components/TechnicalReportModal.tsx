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
import {
  buildHistoricalAverage,
  getLatestNdviAverage,
  parseNdviDataset,
  aggregateWeeklyToMonthly,
} from "@/lib/ndvi";
import { useTranslation, translateCropString } from "@/lib/i18n";
import { NdviChart } from "./NdviChart";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

interface TechnicalReportModalProps {
  open: boolean;
  onClose: () => void;
  type: "public" | "insurance";
  programName?: string;
}

const reportTranslations = {
  es: {
    title: "Informe Técnico Satelital - Evidencia de Riesgo Climático",
    issued: "Emisión",
    data_source:
      "Datos: Copernicus (Sentinel-2 / Copernicus Land Monitoring Service) - datos oficiales del programa de la Unión Europea y la Agencia Espacial Europea (ESA)",

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
    sec2_recent: "Fecha de la imagem más reciente",
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
    sec4_table_unavailable: "Serie histórica no disponible para este período",

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
    sec5_conf_warning: "⚠️ Este resultado requiere revisión humana antes de qualquer acción.",
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
      "Este informe sirve como evidencia técnica complementaria para solicitar acesso a programas públicos de protección rural o para cotización de seguro paramétrico.",
    sec7_warning:
      "Este informe no sustituye el peritaje oficial del programa o de la aseguradora. Es una evidencia técnica de apoio basada en datos satelitales públicos.",

    next_steps_title: "Próximos Pasos",
    next_steps_public_1: "1. Lleva este informe a {institution}.",
    next_steps_public_2: "2. Adjunta tu CAF y documentos personales.",
    next_steps_public_3:
      "3. El informe acelera el análisis, pero la decisión final es del órgão responsable del programa.",
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
    title: "Relatório Técnico Satelital - Evidência de Risco Climático",
    issued: "Emissão",
    data_source:
      "Dados: Copernicus (Sentinel-2 / Copernicus Land Monitoring Service) - dados oficiais do programa da União Europeia e da Agência Espacial Europeia (ESA)",

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
    sec4_param_ref: "Relatório paramétrico de referência: 0.72. Limiar de ativação: 0.50.",
    sec4_table_period: "Período (Mês)",
    sec4_table_current: "NDVI Atual",
    sec4_table_historical: "Média esperada",
    sec4_table_dev: "Desvio",
    sec4_table_status: "Classificação",
    sec4_table_unavailable: "Série histórica indisponível para este período",

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
    toast_share_success: "Evidências compartidas!",
  },
  en: {
    title: "Satellite Technical Report - Climate Risk Evidence",
    issued: "Issued",
    data_source:
      "Data: Copernicus (Sentinel-2 / Copernicus Land Monitoring Service) - data from the European Union and European Space Agency (ESA) program",

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
    sec4_table_unavailable: "Historical series unavailable for this period",

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
  const { farmer, status, fieldPhotoUploaded, activeTerrenoId } = useAppState();
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

  const currentTerreno =
    farmer.terrenos?.find((t) => t.id === activeTerrenoId) || farmer.terrenos?.[0];
  const ndviDataset = parseNdviDataset({
    relatorios_semanais: currentTerreno?.ndviRelatorioSemanal,
    relatorios_mensais: currentTerreno?.ndviRelatorioMensal,
    relatorios: currentTerreno?.ndviHistorico12m,
  });
  let monthlyRows =
    ndviDataset.monthly.length > 0
      ? ndviDataset.monthly
      : ndviDataset.all.filter((row) => row.granularidade !== "weekly");

  if (monthlyRows.length === 0 && ndviDataset.weekly.length > 0) {
    const aggregated = aggregateWeeklyToMonthly(ndviDataset.weekly);
    if (aggregated.length > 0) {
      monthlyRows = aggregated;
    }
  }

  if (monthlyRows.length === 0 && ndviDataset.weekly.length > 0) {
    monthlyRows = ndviDataset.weekly;
  }

  const latestAverage = getLatestNdviAverage(ndviDataset);

  // Determine actual values based on state status
  let currentNdvi = latestAverage?.ndviMedio ?? 0.32;
  let devText = rt.sec3_comp_emergency;
  let visualClass = rt.sec3_status_emergency;
  let textClassColor = "text-destructive bg-destructive/15";
  let statusEmoji = "🔴";

  if (status === "healthy") {
    currentNdvi = 0.72;
    devText = rt.sec3_comp_healthy;
    visualClass = rt.sec3_status_healthy;
    textClassColor = "text-primary bg-primary/15";
    statusEmoji = "🟢";
  } else if (status === "alert") {
    currentNdvi = 0.54;
    devText = rt.sec3_comp_alert;
    visualClass = rt.sec3_status_alert;
    textClassColor = "text-amber-warn bg-amber-warn/15";
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

  const monthlyAverage = buildHistoricalAverage(monthlyRows);
  const monthsData = (monthlyRows.length > 0 ? monthlyRows.slice(-6) : []).map((row, index) => {
    const date = new Date(row.data);
    const period = Number.isNaN(date.getTime())
      ? row.referencia || row.data
      : date.toLocaleDateString(lang === "pt" ? "pt-BR" : lang === "en" ? "en-US" : "es-ES", {
          month: "long",
          year: "numeric",
        });
    const historical =
      monthlyAverage[monthlyAverage.length - (monthlyRows.slice(-6).length - index)] ??
      row.ndviMedio;
    const details =
      row.ndviMedio >= 0.65
        ? { status: rt.sec3_status_healthy, color: "text-primary" }
        : row.ndviMedio >= 0.5
          ? { status: rt.sec3_status_alert, color: "text-amber-warn" }
          : { status: rt.sec3_status_emergency, color: "text-destructive font-bold" };

    return {
      period,
      current: row.ndviMedio,
      historical,
      status: details.status,
      color: details.color,
    };
  });

  const handleExportPDF = async () => {
    setExporting(true);
    try {
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const margin = 20;
      const docWidth = 210;
      const contentWidth = docWidth - 2 * margin; // 170mm
      let y = 20;

      const checkPageBreak = (neededHeight: number) => {
        if (y + neededHeight > 275) {
          doc.addPage();
          y = 20;
        }
      };

      // Header Area
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(0, 0, 0);
      doc.text("SafraSense", margin, y);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(120, 120, 120);
      doc.text("Copernicus Telemetry Node", margin, y + 4.5);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(0, 0, 0);
      doc.text("REF: SS-2026-0001", docWidth - margin, y, { align: "right" });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(120, 120, 120);
      doc.text(
        `${rt.issued}: ${new Date().toLocaleDateString(lang === "pt" ? "pt-BR" : "es-ES")}`,
        docWidth - margin,
        y + 4.5,
        { align: "right" },
      );

      y += 14;

      // Title
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(0, 0, 0);
      const titleLines = doc.splitTextToSize(rt.title, contentWidth);
      doc.text(titleLines, margin, y);
      y += titleLines.length * 6 + 2;

      // Data source
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8.5);
      doc.setTextColor(120, 120, 120);
      const sourceLines = doc.splitTextToSize(rt.data_source, contentWidth);
      doc.text(sourceLines, margin, y);
      y += sourceLines.length * 4.5 + 6;

      const col1 = margin;
      const col2 = margin + 85;

      // Section I: Property Identification
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(21, 128, 61);
      doc.text(rt.sec1_title, margin, y);
      doc.setDrawColor(21, 128, 61);
      doc.setLineWidth(0.3);
      doc.line(margin, y + 1.5, docWidth - margin, y + 1.5);
      y += 6;

      doc.setTextColor(120, 120, 120);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.text(rt.sec1_farmer.toUpperCase(), col1, y);
      doc.text(rt.sec1_car.toUpperCase(), col2, y);
      y += 4.5;

      doc.setTextColor(0, 0, 0);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(farmer.name || "Geraldo Dias", col1, y);
      doc.text(farmer.car || "MG-3170107-123456-78", col2, y);
      y += 6.5;

      doc.setTextColor(120, 120, 120);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.text(rt.sec1_location.toUpperCase(), col1, y);
      doc.text(rt.sec1_coords.toUpperCase(), col2, y);
      y += 4.5;

      doc.setTextColor(0, 0, 0);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      const locationText = farmer.location.includes("Minas Gerais")
        ? farmer.location
        : `${farmer.location}, Minas Gerais, Brasil`;
      doc.text(locationText, col1, y);
      doc.text("Lat: -16.3572, Lon: -46.9061", col2, y);
      y += 6.5;

      doc.setTextColor(120, 120, 120);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.text(rt.sec1_area.toUpperCase(), col1, y);
      doc.text(rt.sec1_crop.toUpperCase(), col2, y);
      y += 4.5;

      doc.setTextColor(0, 0, 0);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(`${farmer.area} ha`, col1, y);
      doc.text(translateCropString(farmer.crop, globalT), col2, y);
      y += 9;

      // Section II: Monitored Period
      checkPageBreak(25);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(21, 128, 61);
      doc.text(rt.sec2_title, margin, y);
      doc.line(margin, y + 1.5, docWidth - margin, y + 1.5);
      y += 6;

      doc.setTextColor(120, 120, 120);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.text(rt.sec2_window.toUpperCase(), col1, y);
      doc.text(rt.sec2_recent.toUpperCase(), col2, y);
      y += 4.5;

      doc.setTextColor(0, 0, 0);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(rt.sec2_window_val, col1, y);
      doc.text(rt.sec2_recent_val, col2, y);
      y += 9;

      // Section III: Current Status
      checkPageBreak(30);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(21, 128, 61);
      doc.text(rt.sec3_title, margin, y);
      doc.line(margin, y + 1.5, docWidth - margin, y + 1.5);
      y += 6;

      doc.setTextColor(0, 0, 0);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(rt.sec3_ndvi + ":", margin, y);
      doc.setFont("helvetica", "bold");
      doc.text(currentNdvi.toFixed(3), docWidth - margin, y, { align: "right" });
      y += 6;

      doc.setFont("helvetica", "normal");
      doc.text(rt.sec3_class + ":", margin, y);
      doc.setFont("helvetica", "bold");

      let statusColor = [34, 197, 94];
      if (status === "alert") statusColor = [245, 158, 11];
      else if (status === "emergency") statusColor = [239, 68, 68];

      doc.setFillColor(statusColor[0], statusColor[1], statusColor[2]);
      doc.rect(docWidth - margin - 35, y - 3, 3, 3, "F");
      doc.text(visualClass, docWidth - margin, y, { align: "right" });
      y += 6;

      doc.setFont("helvetica", "normal");
      doc.text(rt.sec3_comp + ":", margin, y);
      doc.setFont("helvetica", "bold");
      doc.text(devText, docWidth - margin, y, { align: "right" });
      y += 9;

      // Section IV: Historical Series
      checkPageBreak(50);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(21, 128, 61);
      doc.text(rt.sec4_title, margin, y);
      doc.line(margin, y + 1.5, docWidth - margin, y + 1.5);
      y += 4;

      const tableHeaders = [
        [
          rt.sec4_table_period,
          rt.sec4_table_current,
          rt.sec4_table_historical,
          rt.sec4_table_status,
        ],
      ];
      const tableRows =
        monthsData.length > 0
          ? monthsData.map((m) => [
              m.period,
              typeof m.current === "number" ? m.current.toFixed(3) : String(m.current),
              typeof m.historical === "number" ? m.historical.toFixed(3) : String(m.historical),
              m.status,
            ])
          : [[rt.sec4_table_unavailable, "-", "-", "-"]];

      autoTable(doc, {
        startY: y,
        head: tableHeaders,
        body: tableRows,
        theme: "striped",
        headStyles: { fillColor: [21, 128, 61], textColor: [255, 255, 255] },
        margin: { left: margin, right: margin },
        styles: { fontSize: 8.5, font: "helvetica" },
      });

      y = (doc as any).lastAutoTable.finalY + 8;

      // Section V: Climate Event & Confidence
      checkPageBreak(35);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(21, 128, 61);
      doc.text(rt.sec5_title, margin, y);
      doc.line(margin, y + 1.5, docWidth - margin, y + 1.5);
      y += 6;

      doc.setTextColor(0, 0, 0);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      const eventDesc =
        status === "healthy"
          ? lang === "es"
            ? "No se detectaron eventos climáticos adversos en el período analizado."
            : lang === "pt"
              ? "Não foram detectados eventos climáticos adversos no período analisado."
              : "No adverse climate events were detected in the analyzed period."
          : rt.sec5_desc
              .replace("{pct}", status === "alert" ? rt.sec5_pct_alert : rt.sec5_pct_emergency)
              .replace("{start}", rt.sec5_start)
              .replace("{end}", rt.sec5_end);

      const eventLines = doc.splitTextToSize(eventDesc, contentWidth);
      doc.text(eventLines, margin, y);
      y += eventLines.length * 5 + 3;

      doc.setTextColor(120, 120, 120);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.text(rt.sec5_severity.toUpperCase() + ":", margin, y);
      doc.text(rt.sec5_confidence.toUpperCase() + ":", margin + 85, y);
      y += 4.5;

      doc.setTextColor(0, 0, 0);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      const sevLabel =
        status === "healthy"
          ? rt.sec5_sev_healthy
          : status === "alert"
            ? rt.sec5_sev_alert
            : rt.sec5_sev_emergency;
      doc.text(sevLabel, margin, y);
      doc.text(confidenceLevel, margin + 85, y);
      y += 6.5;

      if (isLowConfidence) {
        checkPageBreak(12);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9.5);
        doc.setTextColor(220, 38, 38);
        const warnNoEmoji = rt.sec5_conf_warning.replace(/⚠️\s*/g, "");
        const warnLines = doc.splitTextToSize(warnNoEmoji, contentWidth);
        doc.text(warnLines, margin, y);
        y += warnLines.length * 4.5 + 4.5;
      }

      // Next steps / Próximos passos
      checkPageBreak(25);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(21, 128, 61);
      doc.text(rt.next_steps_title.replace(/👉\s*/g, ""), margin, y);
      doc.line(margin, y + 1.5, docWidth - margin, y + 1.5);
      y += 6;

      doc.setTextColor(0, 0, 0);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);

      const stepList: string[] = [];
      if (type === "public") {
        stepList.push(rt.next_steps_public_1.replace("{institution}", institution));
        stepList.push(rt.next_steps_public_2);
        stepList.push(rt.next_steps_public_3);
      } else {
        stepList.push(rt.next_steps_insurance_1);
        stepList.push(rt.next_steps_insurance_2);
        stepList.push(rt.next_steps_insurance_3);
      }

      stepList.forEach((step, idx) => {
        const stepLines = doc.splitTextToSize(step, contentWidth - 6);
        doc.text(`${idx + 1}.`, margin, y);
        doc.text(stepLines, margin + 6, y);
        y += stepLines.length * 5 + 1.5;
      });
      y += 3.5;

      // Section VII / Purpose / Reservas
      checkPageBreak(30);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(21, 128, 61);
      doc.text(rt.sec7_title, margin, y);
      doc.line(margin, y + 1.5, docWidth - margin, y + 1.5);
      y += 6;

      doc.setTextColor(0, 0, 0);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      const purposeLines = doc.splitTextToSize(rt.sec7_purpose, contentWidth);
      doc.text(purposeLines, margin, y);
      y += purposeLines.length * 5 + 3.5;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(180, 83, 9);
      const warningNotice = rt.sec7_warning.replace(/⚠️\s*/g, "");
      const warningNoticeLines = doc.splitTextToSize(warningNotice, contentWidth);
      doc.text(warningNoticeLines, margin, y);
      y += warningNoticeLines.length * 4.5 + 6;

      // Footnote
      checkPageBreak(12);
      doc.setTextColor(120, 120, 120);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text(rt.footer_tag, margin, y);
      doc.text("SS-2026-0001", docWidth - margin, y, { align: "right" });

      const sanitizeCar = (carStr: string) => {
        return carStr.replace(/[^a-zA-Z0-9]/g, "-").replace(/-+/g, "-");
      };

      const dateStr = new Date().toISOString().slice(0, 10);
      const progNamePart = programName ? `-${programName.toLowerCase()}` : "";
      const carPart = sanitizeCar(farmer.car || "MG-3170107-123456-78");
      const fileName = `evidencia${progNamePart}-${carPart}-${dateStr}.pdf`;

      doc.save(fileName);
      setSuccessToast(rt.toast_pdf_success);
    } catch (error) {
      console.error("PDF generation failed:", error);
      setSuccessToast(
        lang === "es"
          ? "Error al exportar PDF."
          : lang === "pt"
            ? "Erro ao exportar PDF."
            : "Error exporting PDF.",
      );
    } finally {
      setExporting(false);
    }
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
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-0 sm:p-4 overflow-y-auto">
      {/* Toast Notification */}
      {successToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-feature text-feature-foreground rounded-xl px-4 py-2.5 shadow-xl text-sm font-bold flex items-center gap-1.5 animate-in fade-in slide-in-from-top-4 duration-300">
          {successToast.toLowerCase().includes("err") ? (
            <XCircle size={14} className="text-destructive" />
          ) : (
            <CheckCircle2 size={14} className="text-primary" />
          )}
          {successToast}
        </div>
      )}

      <div className="bg-soft w-full max-w-[390px] h-full sm:h-[92vh] sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-border">
        {/* Document Viewer Header Bar */}
        <div className="bg-feature text-feature-foreground px-4 py-3 flex items-center justify-between flex shrink-0 border-b border-border">
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1 text-feature-foreground/60 hover:text-feature-foreground transition-colors cursor-pointer text-sm font-semibold"
          >
            <ArrowLeft size={16} />
            {rt.btn_back}
          </button>
          <span className="text-sm font-extrabold tracking-wider uppercase text-feature-foreground/60">
            {type === "public" ? "POLÍTICA PÚBLICA" : "SEGURO PARAMÉTRICO"}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full hover:bg-feature-foreground/10 text-feature-foreground/60 hover:text-feature-foreground transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable A4 Document Container */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 bg-secondary/50 text-foreground">
          {/* Document Sheet simulating A4 Paper */}
          <div className="bg-card shadow-md rounded-2xl border border-border p-4 sm:p-5 flex flex-col gap-4 text-left relative overflow-hidden">
            {/* Demo Watermark Ribbon */}
            <div className="absolute top-3 -right-12 bg-amber-warn text-amber-warn-foreground font-extrabold text-sm uppercase py-1 px-12 rotate-45 tracking-widest shadow-sm select-none z-20 pointer-events-none flex items-center justify-center">
              {rt.demo_badge}
            </div>

            {/* Cabeçalho */}
            <header className="border-b border-border pb-3 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg overflow-hidden bg-primary p-1 flex items-center justify-center shrink-0">
                    <img
                      src="/logo.png"
                      alt="SafraSense"
                      className="w-full h-full object-cover rounded-md"
                    />
                  </div>
                  <div>
                    <span className="font-extrabold text-sm text-foreground tracking-tight block">
                      SafraSense
                    </span>
                    <span className="text-sm text-muted-foreground block -mt-0.5">
                      Copernicus Telemetry Node
                    </span>
                  </div>
                </div>
                <div className="text-right text-sm font-mono text-muted-foreground">
                  <div className="font-bold text-foreground">REF: SS-2026-0001</div>
                  <div>
                    {rt.issued}: {new Date().toLocaleDateString(lang === "pt" ? "pt-BR" : "es-ES")}
                  </div>
                </div>
              </div>

              <h1 className="text-sm font-extrabold text-foreground uppercase tracking-tight leading-snug mt-1.5">
                {rt.title}
              </h1>

              <p className="text-sm text-muted-foreground leading-tight italic">{rt.data_source}</p>
            </header>

            {/* Seção 1: Identificación */}
            <section className="flex flex-col gap-1.5">
              <h2 className="text-sm font-extrabold uppercase tracking-wider text-primary border-b border-border pb-0.5">
                {rt.sec1_title}
              </h2>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm text-muted-foreground">
                <div>
                  <span className="text-sm uppercase font-bold text-muted-foreground block">
                    {rt.sec1_farmer}
                  </span>
                  <span className="font-bold text-foreground">{farmer.name || "Geraldo Dias"}</span>
                </div>
                <div>
                  <span className="text-sm uppercase font-bold text-muted-foreground block">
                    {rt.sec1_car}
                  </span>
                  <span className="font-mono font-bold text-foreground">
                    {farmer.car || "MG-3170107-123456-78"}
                  </span>
                </div>
                <div>
                  <span className="text-sm uppercase font-bold text-muted-foreground block">
                    {rt.sec1_location}
                  </span>
                  <span className="font-bold text-foreground">
                    {farmer.location.includes("Minas Gerais")
                      ? farmer.location
                      : `${farmer.location}, Minas Gerais, Brasil`}
                  </span>
                </div>
                <div>
                  <span className="text-sm uppercase font-bold text-muted-foreground block">
                    {rt.sec1_coords}
                  </span>
                  <span className="font-mono font-medium text-foreground">
                    Lat: -16.3572, Lon: -46.9061
                  </span>
                </div>
                <div>
                  <span className="text-sm uppercase font-bold text-muted-foreground block">
                    {rt.sec1_area}
                  </span>
                  <span className="font-bold text-foreground">{farmer.area} ha</span>
                </div>
                <div>
                  <span className="text-sm uppercase font-bold text-muted-foreground block">
                    {rt.sec1_crop}
                  </span>
                  <span className="font-bold text-foreground">
                    {translateCropString(farmer.crop, globalT)}
                  </span>
                </div>
              </div>
            </section>

            {/* Seção 2: Período analizado */}
            <section className="flex flex-col gap-1.5">
              <h2 className="text-sm font-extrabold uppercase tracking-wider text-primary border-b border-border pb-0.5">
                {rt.sec2_title}
              </h2>
              <div className="grid grid-cols-2 gap-3 text-sm text-muted-foreground">
                <div>
                  <span className="text-sm uppercase font-bold text-muted-foreground block">
                    {rt.sec2_window}
                  </span>
                  <span className="font-medium text-foreground">{rt.sec2_window_val}</span>
                </div>
                <div>
                  <span className="text-sm uppercase font-bold text-muted-foreground block">
                    {rt.sec2_recent}
                  </span>
                  <span className="font-medium text-foreground">{rt.sec2_recent_val}</span>
                </div>
              </div>
            </section>

            {/* Seção 3: Estado actual de la tierra */}
            <section className="flex flex-col gap-1.5">
              <h2 className="text-sm font-extrabold uppercase tracking-wider text-primary border-b border-border pb-0.5">
                {rt.sec3_title}
              </h2>
              <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                <div className="flex items-center justify-between border-b border-border pb-1">
                  <span>{rt.sec3_ndvi}:</span>
                  <span className="font-mono font-bold text-foreground">
                    {currentNdvi}{" "}
                    <span className="text-sm font-semibold text-amber-warn font-sans">
                      ({rt.demo_badge})
                    </span>
                  </span>
                </div>
                <div className="flex items-center justify-between border-b border-border pb-1">
                  <span>{rt.sec3_class}:</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-sm font-extrabold flex items-center gap-1 ${textClassColor}`}
                  >
                    <span>{statusEmoji}</span> {visualClass}
                  </span>
                </div>
                <div className="flex items-center justify-between pb-0.5">
                  <span>{rt.sec3_comp}:</span>
                  <span className="font-bold text-foreground">{devText}</span>
                </div>
              </div>
            </section>

            {/* Seção 4: Serie histórica */}
            <section
              className={`flex flex-col gap-2 rounded-xl p-2.5 transition-all ${
                type === "insurance"
                  ? "bg-primary/5 border-2 border-primary/30"
                  : "border border-border"
              }`}
            >
              <div className="flex justify-between items-center border-b border-border pb-0.5">
                <h2 className="text-sm font-extrabold uppercase tracking-wider text-primary">
                  {rt.sec4_title}
                </h2>
                {type === "insurance" && (
                  <span className="text-sm font-extrabold text-primary bg-primary/10 px-1.5 py-0.5 rounded uppercase tracking-wider">
                    {lang === "es"
                      ? "Énfasis Seguro"
                      : lang === "pt"
                        ? "Ênfase Seguro"
                        : "Insurance Focus"}
                  </span>
                )}
              </div>

              {type === "insurance" && (
                <div className="text-sm font-bold text-primary leading-tight bg-primary/10 p-2 rounded-lg">
                  💡 {rt.sec4_param_ref}{" "}
                  <span className="text-sm font-normal text-muted-foreground">
                    ({rt.demo_badge})
                  </span>
                </div>
              )}

              {/* NdviChart component */}
              <div className="bg-card rounded-xl p-2 border border-border scale-[0.98] origin-top">
                <NdviChart status={status} />
              </div>

              {/* Table */}
              <div className="border border-border rounded-lg overflow-hidden mt-1.5">
                <table className="w-full text-sm text-left border-collapse">
                  <thead>
                    <tr className="bg-soft border-b border-border text-muted-foreground uppercase text-sm font-bold">
                      <th className="px-2 py-1">{rt.sec4_table_period}</th>
                      <th className="px-2 py-1 text-center">{rt.sec4_table_current}</th>
                      <th className="px-2 py-1 text-center">{rt.sec4_table_historical}</th>
                      <th className="px-2 py-1 text-center">{rt.sec4_table_dev}</th>
                      <th className="px-2 py-1 text-right">{rt.sec4_table_status}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border text-foreground">
                    {monthsData.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-3 py-4 text-center text-muted-foreground font-semibold"
                        >
                          {rt.sec4_table_unavailable}
                        </td>
                      </tr>
                    ) : (
                      monthsData.map((m, idx) => {
                        const devVal = Math.round(
                          ((m.current - m.historical) / m.historical) * 100,
                        );
                        const isNegative = devVal < 0;
                        return (
                          <tr key={idx} className="hover:bg-secondary/50">
                            <td className="px-2 py-1 font-semibold">{m.period}</td>
                            <td className="px-2 py-1 text-center font-mono font-medium">
                              {m.current.toFixed(2)}
                            </td>
                            <td className="px-2 py-1 text-center font-mono text-muted-foreground">
                              {m.historical.toFixed(2)}
                            </td>
                            <td
                              className={`px-2 py-1 text-center font-mono font-bold ${isNegative ? "text-destructive" : "text-primary"}`}
                            >
                              {devVal > 0 ? `+${devVal}` : devVal}%
                            </td>
                            <td className={`px-2 py-1 text-right font-bold text-sm ${m.color}`}>
                              {m.status}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Seção 5: Evento climático detectado */}
            <section
              className={`flex flex-col gap-2 rounded-xl p-2.5 transition-all ${
                type === "public"
                  ? "bg-destructive/5 border-2 border-destructive/30"
                  : "border border-border"
              }`}
            >
              <div className="flex justify-between items-center border-b border-border pb-0.5">
                <h2 className="text-sm font-extrabold uppercase tracking-wider text-primary">
                  {rt.sec5_title}
                </h2>
                {type === "public" && (
                  <span className="text-sm font-extrabold text-destructive bg-destructive/10 px-1.5 py-0.5 rounded uppercase tracking-wider">
                    {lang === "es"
                      ? "Énfasis Governo"
                      : lang === "pt"
                        ? "Ênfase Governo"
                        : "Government Focus"}
                  </span>
                )}
              </div>

              <div className="text-sm text-foreground leading-relaxed font-medium">
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

              <div className="grid grid-cols-2 gap-2 text-sm mt-1 text-muted-foreground">
                <div className="flex justify-between border-b border-border pb-1">
                  <span>{rt.sec5_severity}:</span>
                  <span className="font-bold text-foreground">
                    {status === "healthy"
                      ? rt.sec5_sev_healthy
                      : status === "alert"
                        ? rt.sec5_sev_alert
                        : rt.sec5_sev_emergency}
                  </span>
                </div>
                <div className="flex justify-between border-b border-border pb-1">
                  <span>{rt.sec5_confidence}:</span>
                  <span className="font-bold text-foreground">{confidenceLevel}</span>
                </div>
              </div>

              {isLowConfidence && (
                <div className="mt-1 text-sm font-bold text-destructive bg-destructive/10 p-1.5 rounded border border-destructive/20">
                  {rt.sec5_conf_warning}
                </div>
              )}

              {type === "public" && status !== "healthy" && (
                <div className="mt-1.5 text-sm font-bold text-destructive border-t border-border/30 pt-1.5 italic">
                  ✓ {rt.sec5_compatible.replace("{program}", programName || "Pronaf")}{" "}
                  <span className="text-sm font-normal text-muted-foreground">
                    ({rt.demo_badge})
                  </span>
                </div>
              )}
            </section>

            {/* Seção 6: Verificación de consistencia */}
            <section className="flex flex-col gap-1.5">
              <h2 className="text-sm font-extrabold uppercase tracking-wider text-primary border-b border-border pb-0.5">
                {rt.sec6_title}
              </h2>

              <ul className="flex flex-col gap-1 text-sm text-foreground">
                <li className="flex items-center justify-between border-b border-border pb-1">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 size={12} className="text-primary" />
                    {rt.sec6_car_valid}
                  </span>
                  <span className="font-extrabold text-primary uppercase text-sm">
                    {rt.sec6_yes}
                  </span>
                </li>
                <li className="flex items-center justify-between border-b border-border pb-1">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 size={12} className="text-primary" />
                    {rt.sec6_poly_valid}
                  </span>
                  <span className="font-extrabold text-primary uppercase text-sm">
                    {rt.sec6_yes}
                  </span>
                </li>
                <li className="flex items-center justify-between pb-0.5">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 size={12} className="text-primary" />
                    {rt.sec6_sat_valid}
                  </span>
                  <span className="font-extrabold text-primary uppercase text-sm">
                    {rt.sec6_yes}
                  </span>
                </li>
              </ul>

              <p className="text-sm text-muted-foreground leading-snug italic mt-0.5">
                {rt.sec6_note}
              </p>
            </section>

            {/* Seção 7: Finalidad y reservas */}
            <section className="flex flex-col gap-2">
              <h2 className="text-sm font-extrabold uppercase tracking-wider text-primary border-b border-border pb-0.5">
                {rt.sec7_title}
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed font-medium">
                {rt.sec7_purpose}
              </p>

              {/* Ressalva (Aviso Destacado) */}
              <div className="bg-amber-warn/5 border-l-4 border-amber-warn p-2.5 rounded-r-xl">
                <p className="text-sm leading-relaxed text-amber-warn font-semibold">
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
            <section className="border-t border-border pt-3 flex flex-col gap-1.5 text-left">
              <h3 className="font-extrabold text-sm text-foreground uppercase tracking-tight">
                👉 {rt.next_steps_title}
              </h3>
              <ul className="flex flex-col gap-1 text-sm text-muted-foreground leading-snug">
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
            <footer className="border-t border-border pt-2.5 mt-2 flex flex-col gap-1 text-center text-sm text-muted-foreground">
              <div>{rt.footer_tag}</div>
              <div className="font-mono">
                SHA-256: 8f9b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b · v2.4.1-copernicus
              </div>
            </footer>
          </div>
        </div>

        {/* Document Viewer Action Footer */}
        <div className="bg-soft border-t border-border px-4 py-3.5 flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            disabled={exporting}
            onClick={handleExportPDF}
            className="flex-1 h-11 bg-primary text-primary-foreground rounded-xl font-bold text-sm flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all disabled:opacity-60 cursor-pointer"
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
            className="h-11 px-4 border border-border text-foreground bg-card hover:bg-soft rounded-xl font-bold text-sm flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all cursor-pointer"
          >
            <Share2 size={14} />
            <span className="hidden xs:inline">{rt.btn_share}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="h-11 px-4 text-muted-foreground hover:text-foreground hover:bg-soft rounded-xl font-bold text-sm transition-colors cursor-pointer"
          >
            {rt.btn_back}
          </button>
        </div>
      </div>
    </div>
  );
}
