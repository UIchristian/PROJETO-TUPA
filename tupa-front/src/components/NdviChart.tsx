import { useState } from "react";
import { Info, X } from "lucide-react";
import {
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ComposedChart,
} from "recharts";
import { useAppState } from "@/lib/app-store";
import { useTranslation } from "@/lib/i18n";
import {
  buildHistoricalAverage,
  getLatestNdviAverage,
  parseNdviDataset,
  type NdviHistoryRow,
} from "@/lib/ndvi";

export type ChartStatus = "healthy" | "alert" | "emergency";

const periods = ["Mês", "Semestre", "Ano"] as const;
type PeriodType = (typeof periods)[number];

const periodData = {
  Mês: {
    labels: {
      pt: ["Sem 1", "Sem 2", "Sem 3", "Sem 4"],
      es: ["Sem. 1", "Sem. 2", "Sem. 3", "Sem. 4"],
      en: ["Wk 1", "Wk 2", "Wk 3", "Wk 4"],
    },
    historical: [0.7, 0.71, 0.72, 0.71],
    healthy: [0.71, 0.72, 0.73, 0.7],
    alert: [0.69, 0.67, 0.63, 0.59],
    emergency: [0.62, 0.55, 0.47, 0.42],
  },
  Semestre: {
    labels: {
      pt: ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun"],
      es: ["Ene", "Feb", "Mar", "Abr", "May", "Jun"],
      en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
    },
    historical: [0.68, 0.7, 0.72, 0.73, 0.72, 0.71],
    healthy: [0.66, 0.71, 0.74, 0.72, 0.73, 0.72],
    alert: [0.67, 0.71, 0.6, 0.54, 0.57, 0.55],
    emergency: [0.67, 0.68, 0.46, 0.34, 0.31, 0.29],
  },
  Ano: {
    labels: {
      pt: ["Jul", "Ago", "Set", "Out", "Nov", "Dez", "Jan", "Fev", "Mar", "Abr", "Mai", "Jun"],
      es: ["Jul", "Ago", "Sep", "Oct", "Nov", "Dic", "Ene", "Feb", "Mar", "Abr", "May", "Jun"],
      en: ["Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun"],
    },
    historical: [0.7, 0.69, 0.71, 0.73, 0.72, 0.71, 0.7, 0.71, 0.72, 0.73, 0.71, 0.7],
    healthy: [0.71, 0.68, 0.72, 0.75, 0.74, 0.72, 0.73, 0.72, 0.74, 0.75, 0.73, 0.72],
    alert: [0.68, 0.65, 0.67, 0.5, 0.53, 0.55, 0.57, 0.58, 0.61, 0.59, 0.57, 0.55],
    emergency: [0.62, 0.58, 0.52, 0.3, 0.28, 0.31, 0.34, 0.36, 0.4, 0.39, 0.35, 0.33],
  },
};
function formatWeeklyLabel(item: NdviHistoryRow, language: "pt" | "es" | "en") {
  const dStartStr = item.dataInicial || item.data;
  const dEndStr = item.dataFinal;
  if (!dStartStr) return item.referencia || "";

  const dStart = new Date(dStartStr);
  if (Number.isNaN(dStart.getTime())) return item.referencia || "";

  const formatDay = (d: Date) => String(d.getDate()).padStart(2, "0");
  const formatMonth = (d: Date) => {
    return d.toLocaleDateString(
      language === "pt" ? "pt-BR" : language === "en" ? "en-US" : "es-ES",
      {
        month: "2-digit",
      },
    );
  };

  const weekPrefix = language === "es" ? "Sem. " : language === "en" ? "Wk " : "Sem ";
  const weekMatch =
    String(item.referencia_semana || item.referencia || "").match(/\b[SW](\d+)\b/i) ||
    String(item.referencia_semana || item.referencia || "").match(/^[SW](\d+)/i) ||
    String(item.referencia_semana || item.referencia || "").match(/(?:Sem|Week|Semana|S|W)(\d+)/i);
  const weekNum = weekMatch ? weekMatch[1] : "";

  let rangeStr = "";
  if (dEndStr) {
    const dEnd = new Date(dEndStr);
    if (!Number.isNaN(dEnd.getTime())) {
      if (dStart.getMonth() === dEnd.getMonth()) {
        const connector = language === "en" ? " to " : " a ";
        rangeStr = `${formatDay(dStart)}${connector}${formatDay(dEnd)}/${formatMonth(dStart)}`;
      } else {
        const connector = language === "en" ? " to " : " a ";
        rangeStr = `${formatDay(dStart)}/${formatMonth(dStart)}${connector}${formatDay(dEnd)}/${formatMonth(dEnd)}`;
      }
    }
  }

  if (!rangeStr) {
    rangeStr = `${formatDay(dStart)}/${formatMonth(dStart)}`;
  }

  return rangeStr;
}

function buildNdviChartFromHistory(history: NdviHistoryRow[], language: "pt" | "es" | "en") {
  if (history.length === 0) {
    return null;
  }

  const locale = language === "pt" ? "pt-BR" : language === "en" ? "en-US" : "es-ES";
  const historical = buildHistoricalAverage(history);

  return {
    labels: history.map((item) => {
      if (item.granularidade === "weekly" || item.referencia_semana) {
        return formatWeeklyLabel(item, language);
      }

      const d = new Date(item.data);
      if (Number.isNaN(d.getTime())) return item.data;
      const denseSeries = history.length > 8;
      return d.toLocaleDateString(locale, {
        month: "short",
        ...(history.length > 6 && !denseSeries ? { year: "2-digit" as const } : {}),
      });
    }),
    current: history.map((item) => item.ndviMedio),
    historical,
    rows: history,
  };
}

// Helper to translate NDVI value into simple words, colors and indicators
export function getStatusDetails(v: number, language: "pt" | "es" | "en" = "pt") {
  if (v >= 0.65) {
    return {
      color: "#2e7d32",
      bgClass: "bg-primary text-primary-foreground",
      text: language === "es" ? "Saludable" : language === "en" ? "Healthy" : "Saudável",
      emoji: "🟢",
      description:
        language === "es" ? "Saludable 🌱" : language === "en" ? "Healthy 🌱" : "Saudável 🌱",
    };
  } else if (v >= 0.2) {
    return {
      color: "#f57c00",
      bgClass: "bg-amber-warn text-amber-warn-foreground",
      text: language === "es" ? "Atención" : language === "en" ? "Caution" : "Atenção",
      emoji: "🟡",
      description:
        language === "es" ? "Estrés ⚠️" : language === "en" ? "Stress ⚠️" : "Estresse ⚠️",
    };
  } else {
    return {
      color: "#d32f2f",
      bgClass: "bg-destructive text-destructive-foreground",
      text: language === "es" ? "Seco" : language === "en" ? "Dry" : "Seco",
      emoji: "🔴",
      description:
        language === "es"
          ? "Sequía crítica 🚨"
          : language === "en"
            ? "Critical drought 🚨"
            : "Seca Crítica 🚨",
    };
  }
}

export const cropEmojis: Record<string, string> = {
  Milho: "🌽",
  Soja: "🌱",
  Café: "☕",
  Feijão: "🫘",
  "Cana-de-açúcar": "🎋",
  Laranja: "🍊",
  Batata: "🥔",
  Mandioca: "🍠",
  Algodão: "☁️",
  Outro: "🌱",
};

interface CustomCornBarProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  payload?: { current?: number };
  cropEmoji?: string;
}

// Custom SVG shape for drawing corn cobs based on health status
function CustomCornBar({
  x = 0,
  y = 0,
  width = 0,
  height = 0,
  payload,
  cropEmoji,
}: CustomCornBarProps) {
  if (!width || !height) return null;

  const v = payload?.current ?? 0;
  let state: "healthy" | "warn" | "danger" = "healthy";
  if (v < 0.2) state = "danger";
  else if (v < 0.65) state = "warn";

  // Gradient fill ID based on state
  const fillId =
    state === "healthy"
      ? "url(#healthyGrad)"
      : state === "warn"
        ? "url(#warnGrad)"
        : "url(#dangerGrad)";

  // Emoji badge configuration
  const emoji = state === "healthy" ? cropEmoji || "🌽" : state === "warn" ? "⚠️" : "🚨";

  // Radius for the rounded corners (cylinder top)
  const radius = Math.min(width / 2, 8);

  const cx = x + width / 2;
  const badgeRadius = 11; // 22px diameter
  const badgeY = y - 5; // Float slightly above the top of the cylinder

  return (
    <g>
      {/* Cylindrical bar with rounded top and flat bottom */}
      <path
        d={`
          M ${x},${y + height}
          L ${x},${y + radius}
          A ${radius},${radius} 0 0 1 ${x + width},${y + radius}
          L ${x + width},${y + height}
          Z
        `}
        fill={fillId}
        className="transition-all duration-300 hover:opacity-90 cursor-pointer"
      />

      {/* Floating Circle Badge */}
      <g transform={`translate(${cx}, ${badgeY})`} className="cursor-pointer">
        {/* Shadow / Glow effect */}
        <circle r={badgeRadius} fill="rgba(0,0,0,0.15)" cy={1.5} />
        {/* White border circle */}
        <circle
          r={badgeRadius}
          fill="#FFFFFF"
          stroke={state === "healthy" ? "#22C55E" : state === "warn" ? "#F59E0B" : "#EF4444"}
          strokeWidth={1.5}
        />
        {/* Emoji text */}
        <text
          x={0}
          y={4}
          textAnchor="middle"
          fontSize={12}
          style={{ fontFamily: "Segoe UI Emoji, Apple Color Emoji, Noto Color Emoji, sans-serif" }}
        >
          {emoji}
        </text>
      </g>
    </g>
  );
}

export function NdviChart({ status }: { status: ChartStatus }) {
  const { language } = useTranslation();
  const { farmer, activeTerrenoId } = useAppState();
  const [period, setPeriod] = useState<PeriodType>("Semestre");
  const [showNdviInfo, setShowNdviInfo] = useState(false);

  const currentTerreno =
    farmer?.terrenos?.find((t) => t.id === activeTerrenoId) || farmer?.terrenos?.[0];
  const firstCrop = currentTerreno?.crops?.[0] || "Milho";
  const cropEmoji = cropEmojis[firstCrop] || "🌽";

  const rawSystem = currentTerreno?.system || "second_harvest";
  let systemLabel = "";
  if (rawSystem === "first_harvest" || rawSystem.toLowerCase() === "primeira safra") {
    systemLabel =
      language === "es" ? "Safra actual" : language === "en" ? "Current crop" : "Safra atual";
  } else if (rawSystem === "second_harvest" || rawSystem.toLowerCase() === "safrinha") {
    systemLabel =
      language === "es"
        ? "Safrinha actual"
        : language === "en"
          ? "Current safrinha"
          : "Safrinha atual";
  } else if (
    rawSystem === "rotation" ||
    rawSystem.toLowerCase() === "rotação" ||
    rawSystem.toLowerCase() === "rotacao"
  ) {
    systemLabel =
      language === "es"
        ? "Rotación actual"
        : language === "en"
          ? "Current rotation"
          : "Rotação atual";
  } else {
    systemLabel =
      language === "es" ? "Safra actual" : language === "en" ? "Current crop" : "Safra atual";
  }

  const activeLang = language === "en" ? "en" : language === "pt" ? "pt" : "es";
  const ndviDataset = parseNdviDataset({
    relatorios_semanais: currentTerreno?.ndviRelatorioSemanal,
    relatorios_mensais: currentTerreno?.ndviRelatorioMensal,
    relatorios: currentTerreno?.ndviHistorico12m,
  });
  const monthlyRows =
    ndviDataset.monthly.length > 0
      ? ndviDataset.monthly
      : ndviDataset.all.filter((row) => row.granularidade !== "weekly");
  const weeklyRows = ndviDataset.weekly;
  const dynamicMes =
    weeklyRows.length > 0 ? buildNdviChartFromHistory(weeklyRows.slice(-4), activeLang) : null;
  const dynamicSemestre =
    monthlyRows.length > 0 ? buildNdviChartFromHistory(monthlyRows.slice(-6), activeLang) : null;
  const dynamicAno =
    monthlyRows.length > 0 ? buildNdviChartFromHistory(monthlyRows.slice(-12), activeLang) : null;
  const latestAverage = getLatestNdviAverage(ndviDataset);

  const pData = periodData[period];
  const activeLabels =
    period === "Mês" && dynamicMes
      ? dynamicMes.labels
      : period === "Ano" && dynamicAno
        ? dynamicAno.labels
        : period === "Semestre" && dynamicSemestre
          ? dynamicSemestre.labels
          : pData.labels[activeLang];
  const activeHistorical =
    period === "Ano" && dynamicAno
      ? dynamicAno.historical
      : period === "Semestre" && dynamicSemestre
        ? dynamicSemestre.historical
        : period === "Mês" && dynamicMes
          ? dynamicMes.historical
          : pData.historical;
  const activeCurrent =
    period === "Ano" && dynamicAno
      ? dynamicAno.current
      : period === "Semestre" && dynamicSemestre
        ? dynamicSemestre.current
        : period === "Mês" && dynamicMes
          ? dynamicMes.current
          : status === "emergency"
            ? pData.emergency
            : status === "alert"
              ? pData.alert
              : pData.healthy;
  const activeRows =
    period === "Ano" && dynamicAno
      ? dynamicAno.rows
      : period === "Semestre" && dynamicSemestre
        ? dynamicSemestre.rows
        : period === "Mês" && dynamicMes
          ? dynamicMes.rows
          : [];

  const data = activeLabels.map((lbl, i) => {
    const hist = activeHistorical[i];
    const curr = activeCurrent[i];
    const lower = +(hist - 0.08).toFixed(2);
    const upper = +(hist + 0.08).toFixed(2);
    const rowAverage = activeRows[i]?.ndviMedio ?? curr;
    return {
      month: lbl,
      historical: hist,
      lower,
      upper,
      range: upper - lower,
      current: curr,
      ndviMedio: rowAverage,
    };
  });

  if (!ndviDataset || ndviDataset.all.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary text-2xl mb-4 shadow-soft">
          📡
        </div>
        <h4 className="font-bold text-navy text-base">
          {language === "es"
            ? "Análisis satelital en procesamiento"
            : language === "en"
              ? "Satellite analysis in progress"
              : "Análise de satélite em processamento"}
        </h4>
        <p className="text-xs text-muted-foreground mt-1.5 max-w-[240px] leading-relaxed">
          {language === "es"
            ? "Sin datos para este terreno aún. Estamos recolectando y procesando imágenes satelitales."
            : language === "en"
              ? "No data for this terrain yet. We are gathering and processing satellite imagery."
              : "Sem dados para este terreno ainda. Estamos coletando e processando imagens de satélite."}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="w-full flex flex-col">
        {/* Google Calendar-like Period Selector Segmented Control */}
        <div className="flex justify-between items-center mb-3 bg-secondary/80 rounded-xl p-1 border border-border/40 shrink-0">
          {periods.map((p) => {
            const isActive = period === p;
            const label =
              p === "Mês"
                ? language === "es"
                  ? "Mes"
                  : language === "en"
                    ? "Month"
                    : "Mês"
                : p === "Semestre"
                  ? language === "es"
                    ? "Semestre"
                    : language === "en"
                      ? "Semester"
                      : "Semestre"
                  : language === "es"
                    ? "Año"
                    : language === "en"
                      ? "Year"
                      : "Ano";
            return (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={`flex-1 text-center h-11 flex items-center justify-center rounded-lg text-sm font-bold transition-all cursor-pointer ${
                  isActive
                    ? "bg-card text-primary shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-card/40"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="rounded-xl border border-border/40 bg-soft/40 px-3 py-2.5">
            <div className="flex items-center gap-1.5">
              <span className="text-sm uppercase tracking-wider text-muted-foreground font-bold">
                {language === "es"
                  ? "NDVI medio actual"
                  : language === "en"
                    ? "Current average NDVI"
                    : "NDVI medio atual"}
              </span>
              <button
                type="button"
                onClick={() => setShowNdviInfo(true)}
                className="w-5 h-5 rounded-full bg-muted-foreground/20 hover:bg-muted-foreground/35 flex items-center justify-center shrink-0 cursor-pointer transition-colors"
                aria-label="O que é NDVI?"
              >
                <Info size={12} className="text-muted-foreground" />
              </button>
            </div>
            <span className="text-xl font-black text-foreground tabular-nums">
              {latestAverage ? latestAverage.ndviMedio.toFixed(3) : "--"}
            </span>
          </div>
          <div className="rounded-xl border border-border/40 bg-soft/40 px-3 py-2.5">
            <span className="text-sm uppercase tracking-wider text-muted-foreground font-bold block">
              {language === "es" ? "Fuente" : language === "en" ? "Source" : "Fonte"}
            </span>
            <span className="text-sm font-bold text-foreground">
              {period === "Mês"
                ? language === "es"
                  ? "Informe semanal"
                  : language === "en"
                    ? "Weekly report"
                    : "Relatório semanal"
                : language === "es"
                  ? "Informe mensual"
                  : language === "en"
                    ? "Monthly report"
                    : "Relatório mensal"}
            </span>
          </div>
        </div>

        {/* 6-Month Status Visual Timeline (Semáforo) */}
        <div className="flex gap-3 items-center px-3 py-2.5 mb-4 bg-soft/50 rounded-xl border border-border/40 overflow-x-auto no-scrollbar">
          {data.map((item, idx) => {
            const details = getStatusDetails(item.current, activeLang);
            return (
              <div key={idx} className="flex flex-col items-center gap-1.5 min-w-[56px] shrink-0">
                <span
                  className={`text-muted-foreground font-semibold uppercase tracking-wider ${period === "Mês" ? "text-[10px]" : "text-sm"}`}
                >
                  {item.month}
                </span>
                <span
                  className={`w-6 h-6 rounded-full ${details.bgClass} shadow-sm animate-pulse flex items-center justify-center text-sm font-black`}
                  style={{ animationDuration: `${1.5 + idx * 0.4}s` }}
                >
                  {item.current >= 0.65 ? "✓" : item.current >= 0.2 ? "!" : "✕"}
                </span>
                <span className="text-[11px] font-bold text-foreground/80 text-center leading-tight max-w-full">
                  {details.text}
                </span>
              </div>
            );
          })}
        </div>

        {/* Bar Chart representing health index of each period interval */}
        <div className="w-full overflow-x-auto no-scrollbar">
          <div
            className="h-[180px]"
            style={{
              minWidth: data.length > 6 ? `${data.length * 60}px` : "100%",
            }}
          >
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -5 }}>
                <defs>
                  <linearGradient id="healthyGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#4ADE80" />
                    <stop offset="100%" stopColor="#15803D" />
                  </linearGradient>
                  <linearGradient id="warnGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#FBBF24" />
                    <stop offset="100%" stopColor="#D97706" />
                  </linearGradient>
                  <linearGradient id="dangerGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#F87171" />
                    <stop offset="100%" stopColor="#DC2626" />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#EFEAE0" vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: period === "Mês" ? 9 : 12, fill: "#7a7a7a" }}
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                />
                <YAxis
                  domain={[-1, 1]}
                  ticks={[-1, -0.5, 0, 0.2, 0.5, 0.75, 1]}
                  tickFormatter={(v) => {
                    if (v === 1)
                      return language === "es"
                        ? "Excelente"
                        : language === "en"
                          ? "Excellent"
                          : "Excelente";
                    if (v === 0.75)
                      return language === "es"
                        ? "Saludable"
                        : language === "en"
                          ? "Healthy"
                          : "Saudável";
                    if (v === 0.5)
                      return language === "es"
                        ? "Atención"
                        : language === "en"
                          ? "Caution"
                          : "Atenção";
                    if (v === 0.2)
                      return language === "es"
                        ? "Sequía"
                        : language === "en"
                          ? "Drought"
                          : "Seca crítica";
                    if (v === 0)
                      return language === "es"
                        ? "Neutro"
                        : language === "en"
                          ? "Neutral"
                          : "Neutro";
                    if (v === -0.5)
                      return language === "es"
                        ? "Muy bajo"
                        : language === "en"
                          ? "Very low"
                          : "Muito baixo";
                    if (v === -1)
                      return language === "es"
                        ? "Mínimo"
                        : language === "en"
                          ? "Minimum"
                          : "Mínimo";
                    return "";
                  }}
                  tick={{ fontSize: 12, fill: "#7a7a7a", fontWeight: "medium" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    border: "none",
                    borderRadius: 12,
                    fontSize: 12,
                    boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
                  }}
                  formatter={(v: number, name: string) => {
                    const historicalLabel =
                      language === "es"
                        ? "Promedio histórico"
                        : language === "en"
                          ? "Historical average"
                          : "Média histórica";
                    if (name === historicalLabel || name === "") {
                      return [v.toFixed(2), name];
                    }
                    const details = getStatusDetails(v, activeLang);
                    return [`${v.toFixed(3)} (${details.description})`, name];
                  }}
                />

                {/* Historical Average comparison line */}
                <Line
                  type="monotone"
                  dataKey="historical"
                  stroke="#9E9E9E"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  dot={false}
                  name={
                    language === "es"
                      ? "Promedio histórico"
                      : language === "en"
                        ? "Historical average"
                        : "Média histórica"
                  }
                />

                {/* Current health index represented as color-coded bars (drawn as Corn cobs) */}
                <Bar
                  dataKey="current"
                  shape={<CustomCornBar cropEmoji={cropEmoji} />}
                  name={`${systemLabel} · NDVI medio`}
                  barSize={24}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-border/40 overflow-hidden bg-card">
          <div className="grid grid-cols-[1.4fr_0.8fr_0.8fr] gap-2 px-3 py-2 bg-secondary/60 text-sm font-bold text-foreground/80">
            <span>{language === "es" ? "Periodo" : language === "en" ? "Period" : "Período"}</span>
            <span className="text-center">
              {language === "es" ? "NDVI medio" : language === "en" ? "Avg NDVI" : "NDVI medio"}
            </span>
            <span className="text-center">
              {language === "es"
                ? "Prom. histórico"
                : language === "en"
                  ? "Hist. avg"
                  : "Média Histórica"}
            </span>
          </div>
          <div className="divide-y divide-border/30">
            {data.slice(-6).map((item, idx) => (
              <div
                key={`${item.month}-${idx}`}
                className="grid grid-cols-[1.4fr_0.8fr_0.8fr] gap-2 px-3 py-2.5 text-sm text-foreground/85"
              >
                <span className="font-medium">{item.month}</span>
                <span className="text-center tabular-nums font-bold">
                  {item.ndviMedio.toFixed(3)}
                </span>
                <span className="text-center tabular-nums text-muted-foreground">
                  {item.historical.toFixed(3)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── NDVI Info Modal ── */}
      {showNdviInfo && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end justify-center pb-16 animate-in fade-in duration-200"
          onClick={() => setShowNdviInfo(false)}
        >
          <div
            className="bg-card w-full max-w-[390px] rounded-t-3xl shadow-2xl border border-border/80 flex flex-col max-h-[80vh] animate-in slide-in-from-bottom-4 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-border flex items-center justify-between shrink-0">
              <h2 className="text-base font-bold text-foreground">
                {language === "es"
                  ? "¿Qué es el NDVI?"
                  : language === "en"
                    ? "What is NDVI?"
                    : "O que é NDVI?"}
              </h2>
              <button
                type="button"
                onClick={() => setShowNdviInfo(false)}
                className="p-1.5 rounded-full hover:bg-secondary text-muted-foreground cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-4 text-sm text-foreground/90 leading-relaxed">
              <section className="flex flex-col gap-1.5">
                <h3 className="font-bold text-foreground">
                  {language === "es" ? "Definição" : language === "en" ? "Definition" : "Definição"}
                </h3>
                <p>
                  {language === "es"
                    ? "NDVI significa Índice de Vegetación de Diferencia Normalizada. Es un indicador calculado a partir de imágenes satelitales que mide la cantidad y salud de la vegetación en una área."
                    : language === "en"
                      ? "NDVI stands for Normalized Difference Vegetation Index. It is an indicator calculated from satellite imagery that measures the amount and health of vegetation in an area."
                      : "NDVI significa Índice de Vegetação por Diferença Normalizada. É um indicador calculado a partir de imagens de satélite que mede a quantidade e a saúde da vegetação em uma área."}
                </p>
              </section>

              <section className="flex flex-col gap-1.5">
                <h3 className="font-bold text-foreground">
                  {language === "es"
                    ? "Escala de valores"
                    : language === "en"
                      ? "Value scale"
                      : "Escala de valores"}
                </h3>
                <p>
                  {language === "es"
                    ? "El índice varía de -1 a +1. Valores cercanos a +1 indican vegetación densa y saludable. Valores cercanos a 0 o negativos indican suelo desnudo, agua o vegetación muy estresada."
                    : language === "en"
                      ? "The index ranges from -1 to +1. Values close to +1 indicate dense, healthy vegetation. Values close to 0 or negative indicate bare soil, water, or severely stressed vegetation."
                      : "O índice varia de -1 a +1. Valores próximos de +1 indicam vegetação densa e saudável. Valores próximos de 0 ou negativos indicam solo exposto, água ou vegetação muito estressada."}
                </p>
              </section>

              <section className="flex flex-col gap-2">
                <h3 className="font-bold text-foreground">
                  {language === "es"
                    ? "Interpretación en SafraSense"
                    : language === "en"
                      ? "Interpretation in SafraSense"
                      : "Interpretação no SafraSense"}
                </h3>
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-emerald-500 shrink-0" />
                    <span>
                      {language === "es"
                        ? "Saludable (≥ 0.65): cultivo con buena cobertura vegetal."
                        : language === "en"
                          ? "Healthy (≥ 0.65): crop with good vegetation cover."
                          : "Saudável (≥ 0,65): lavoura com boa cobertura vegetal."}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-amber-500 shrink-0" />
                    <span>
                      {language === "es"
                        ? "Atención (0.20 – 0.64): estrés hídrico o vegetación en desarrollo."
                        : language === "en"
                          ? "Caution (0.20 – 0.64): water stress or developing vegetation."
                          : "Atenção (0,20 – 0,64): estresse hídrico ou vegetação em desenvolvimento."}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-rose-500 shrink-0" />
                    <span>
                      {language === "es"
                        ? "Seco (< 0.20): seca crítica o sin vegetación activa."
                        : language === "en"
                          ? "Dry (< 0.20): critical drought or no active vegetation."
                          : "Seco (< 0,20): seca crítica ou sem vegetação ativa."}
                    </span>
                  </div>
                </div>
              </section>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-border bg-soft shrink-0">
              <button
                type="button"
                onClick={() => setShowNdviInfo(false)}
                className="h-12 w-full bg-primary text-primary-foreground rounded-xl font-bold text-sm hover:opacity-90 transition-all cursor-pointer"
              >
                {language === "es" ? "Entendido" : language === "en" ? "Got it" : "Entendido"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
