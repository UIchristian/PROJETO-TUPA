import { useState } from "react";
import {
  Line,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ComposedChart,
} from "recharts";
import { useAppState } from "@/lib/app-store";
import { useTranslation } from "@/lib/i18n";

export type ChartStatus = "healthy" | "alert" | "emergency";

const periods = ["Dia", "Semana", "Mês", "Semestre", "Ano"] as const;
type PeriodType = (typeof periods)[number];

const periodData = {
  Dia: {
    labels: {
      pt: ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"],
      es: ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"],
      en: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    },
    historical: [0.72, 0.72, 0.72, 0.72, 0.72, 0.72, 0.72],
    healthy: [0.73, 0.71, 0.74, 0.72, 0.75, 0.73, 0.74],
    alert: [0.7, 0.68, 0.65, 0.61, 0.58, 0.55, 0.52],
    emergency: [0.65, 0.58, 0.49, 0.44, 0.38, 0.35, 0.32],
  },
  Semana: {
    labels: {
      pt: ["Sem 1", "Sem 2", "Sem 3", "Sem 4"],
      es: ["Sem 1", "Sem 2", "Sem 3", "Sem 4"],
      en: ["Wk 1", "Wk 2", "Wk 3", "Wk 4"],
    },
    historical: [0.7, 0.71, 0.72, 0.71],
    healthy: [0.71, 0.72, 0.73, 0.7],
    alert: [0.69, 0.67, 0.63, 0.59],
    emergency: [0.62, 0.55, 0.47, 0.42],
  },
  Mês: {
    labels: {
      pt: ["Mar", "Abr", "Mai", "Jun"],
      es: ["Mar", "Abr", "May", "Jun"],
      en: ["Mar", "Apr", "May", "Jun"],
    },
    historical: [0.71, 0.72, 0.73, 0.72],
    healthy: [0.72, 0.73, 0.71, 0.74],
    alert: [0.7, 0.66, 0.61, 0.57],
    emergency: [0.64, 0.56, 0.45, 0.39],
  },
  Semestre: {
    labels: {
      pt: ["1ºS/24", "2ºS/24", "1ºS/25", "2ºS/25"],
      es: ["1ºS/24", "2ºS/24", "1ºS/25", "2ºS/25"],
      en: ["1S/24", "2S/24", "1S/25", "2S/25"],
    },
    historical: [0.68, 0.72, 0.73, 0.72],
    healthy: [0.66, 0.71, 0.74, 0.72],
    alert: [0.67, 0.71, 0.6, 0.54],
    emergency: [0.67, 0.68, 0.46, 0.34],
  },
  Ano: {
    labels: {
      pt: ["2023", "2024", "2025", "2026"],
      es: ["2023", "2024", "2025", "2026"],
      en: ["2023", "2024", "2025", "2026"],
    },
    historical: [0.7, 0.69, 0.71, 0.73],
    healthy: [0.71, 0.68, 0.72, 0.75],
    alert: [0.68, 0.65, 0.67, 0.5],
    emergency: [0.62, 0.58, 0.52, 0.3],
  },
};

// Helper to translate NDVI value into simple words, colors and indicators
export function getStatusDetails(v: number) {
  if (v >= 0.65) {
    return {
      color: "#2e7d32", // Green for healthy
      bgClass: "bg-emerald-500",
      text: "Saudável",
      emoji: "🟢",
      description: "Saudável 🌱",
    };
  } else if (v >= 0.5) {
    return {
      color: "#f57c00", // Amber for caution
      bgClass: "bg-amber-500",
      text: "Atenção",
      emoji: "🟡",
      description: "Estresse ⚠️",
    };
  } else {
    return {
      color: "#d32f2f", // Red for dry/emergency
      bgClass: "bg-red-500",
      text: "Seco",
      emoji: "🔴",
      description: "Seca Crítica 🚨",
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
  if (v < 0.5) state = "danger";
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
  const pData = periodData[period];
  const activeLabels = pData.labels[activeLang];
  const activeHistorical = pData.historical;
  const activeCurrent =
    status === "emergency" ? pData.emergency : status === "alert" ? pData.alert : pData.healthy;

  const data = activeLabels.map((lbl, i) => {
    const hist = activeHistorical[i];
    const curr = activeCurrent[i];
    const lower = +(hist - 0.08).toFixed(2);
    const upper = +(hist + 0.08).toFixed(2);
    return {
      month: lbl,
      historical: hist,
      lower,
      upper,
      range: upper - lower,
      current: curr,
    };
  });

  return (
    <div className="w-full flex flex-col">
      {/* Google Calendar-like Period Selector Segmented Control */}
      <div className="flex justify-between items-center mb-3 bg-secondary/80 rounded-xl p-1 border border-border/40 shrink-0">
        {periods.map((p) => {
          const isActive = period === p;
          const label =
            p === "Dia"
              ? language === "es"
                ? "Día"
                : language === "en"
                  ? "Day"
                  : "Dia"
              : p === "Semana"
                ? language === "es"
                  ? "Semana"
                  : language === "en"
                    ? "Week"
                    : "Semana"
                : p === "Mês"
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
              className={`flex-1 text-center py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                isActive
                  ? "bg-white text-primary shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/40"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* 6-Month Status Visual Timeline (Semáforo) */}
      <div className="flex justify-between items-center px-3 py-2.5 mb-4 bg-soft/50 rounded-xl border border-border/40">
        {data.map((item, idx) => {
          const details = getStatusDetails(item.current);
          return (
            <div key={idx} className="flex flex-col items-center gap-1.5 flex-1">
              <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
                {item.month}
              </span>
              <span
                className={`w-3.5 h-3.5 rounded-full ${details.bgClass} shadow-sm animate-pulse`}
                style={{ animationDuration: `${1.5 + idx * 0.4}s` }}
              />
              <span className="text-[9px] font-bold text-foreground/80">{details.text}</span>
            </div>
          );
        })}
      </div>

      {/* Bar Chart representing health index of each period interval */}
      <div className="w-full h-[180px]">
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
              tick={{ fontSize: 11, fill: "#7a7a7a" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={[0.2, 1]}
              ticks={[0.25, 0.5, 0.75, 1]}
              tickFormatter={(v) => {
                if (v === 1) return "Excelente";
                if (v === 0.75) return "Saudável";
                if (v === 0.5) return "Atenção";
                if (v === 0.25) return "Seco";
                return "";
              }}
              tick={{ fontSize: 9, fill: "#7a7a7a", fontWeight: "medium" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                border: "none",
                borderRadius: 12,
                fontSize: 11,
                boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
              }}
              formatter={(v: number, name: string) => {
                if (name === "Média histórica" || name === "") {
                  return [v.toFixed(2), name];
                }
                const details = getStatusDetails(v);
                return [`${v.toFixed(2)} (${details.description})`, name];
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
              name="Média histórica"
            />

            {/* Current health index represented as color-coded bars (drawn as Corn cobs) */}
            <Bar
              dataKey="current"
              shape={<CustomCornBar cropEmoji={cropEmoji} />}
              name={systemLabel}
              barSize={24}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
