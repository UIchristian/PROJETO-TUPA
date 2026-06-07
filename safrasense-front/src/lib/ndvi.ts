export type NdviGranularity = "weekly" | "monthly" | "unknown";

export type NdviHistoryRow = {
  data: string;
  ndvi: number;
  ndviMedio: number;
  dataInicial?: string;
  dataFinal?: string;
  referencia?: string;
  granularidade?: NdviGranularity;
  [key: string]: any;
};

export type NdviDataset = {
  weekly: NdviHistoryRow[];
  monthly: NdviHistoryRow[];
  all: NdviHistoryRow[];
};

function normalizeDate(value: any): string | null {
  if (value === undefined || value === null || value === "") return null;

  const strValue = String(value);
  const parsed = new Date(strValue);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  // Tentar extrair com expressão regular a primeira data no formato AAAA-MM-DD embutida na string
  const match = strValue.match(/\b\d{4}-\d{2}-\d{2}\b/);
  if (match) {
    const extractedDate = new Date(match[0]);
    if (!Number.isNaN(extractedDate.getTime())) {
      return match[0];
    }
  }

  return strValue;
}

export function parseLocaleNumber(value: any): number | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const raw = String(value).trim();
  if (!raw) return null;

  const hasComma = raw.includes(",");
  const normalized = hasComma ? raw.replace(/\./g, "").replace(/,/g, ".") : raw;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function pickNdviDate(row: any): string | null {
  return normalizeDate(
    row?.data ??
      row?.date ??
      row?.referencia_semana ??
      row?.referencia_mes ??
      row?.mes ??
      row?.month ??
      row?.periodo ??
      row?.period ??
      row?.competencia,
  );
}

function inferGranularity(row: any, dataInicial?: string, dataFinal?: string): NdviGranularity {
  if (row?.granularidade === "weekly" || row?.granularity === "weekly") return "weekly";
  if (row?.granularidade === "monthly" || row?.granularity === "monthly") return "monthly";
  if (row?.referencia_semana || row?.semana || row?.week) return "weekly";
  if (row?.referencia_mes || row?.mes || row?.month) return "monthly";

  if (dataInicial && dataFinal) {
    const start = new Date(dataInicial).getTime();
    const end = new Date(dataFinal).getTime();
    if (!Number.isNaN(start) && !Number.isNaN(end) && end >= start) {
      const diffDays = Math.round((end - start) / 86400000) + 1;
      if (diffDays <= 10) return "weekly";
      if (diffDays <= 35) return "monthly";
    }
  }

  return "unknown";
}

function pickNdviValue(row: any): number | null {
  return parseLocaleNumber(
    row?.ndvi ??
      row?.ndvi_medio ??
      row?.media_ndvi ??
      row?.mean_ndvi ??
      row?.valor_ndvi ??
      row?.valor ??
      row?.value,
  );
}

function uniqueSorted(rows: NdviHistoryRow[], limit: number): NdviHistoryRow[] {
  const map = new Map<string, NdviHistoryRow>();
  for (const row of rows) {
    map.set(`${row.granularidade ?? "unknown"}-${row.data}-${row.referencia ?? ""}`, row);
  }

  return Array.from(map.values())
    .sort((a, b) => {
      const aTime = new Date(a.data).getTime();
      const bTime = new Date(b.data).getTime();
      if (Number.isNaN(aTime) || Number.isNaN(bTime)) return 0;
      return aTime - bTime;
    })
    .slice(-limit);
}

export function parseNdviDataset(payload: any): NdviDataset {
  const candidateLists = [
    Array.isArray(payload) ? payload : null,
    Array.isArray(payload?.relatorios) ? payload.relatorios : null,
    Array.isArray(payload?.relatorios_semanais) ? payload.relatorios_semanais : null,
    Array.isArray(payload?.relatorios_mensais) ? payload.relatorios_mensais : null,
    Array.isArray(payload?.semanal) ? payload.semanal : null,
    Array.isArray(payload?.mensal) ? payload.mensal : null,
    Array.isArray(payload?.dados) ? payload.dados : null,
    Array.isArray(payload?.data) ? payload.data : null,
    Array.isArray(payload?.tabela) ? payload.tabela : null,
    Array.isArray(payload?.ndvi) ? payload.ndvi : null,
    Array.isArray(payload?.resultados) ? payload.resultados : null,
  ].filter((list): list is any[] => Array.isArray(list));

  const allRows = candidateLists
    .flat()
    .map((row) => {
      const data = pickNdviDate(row);
      const ndvi = pickNdviValue(row);
      if (!data || ndvi === null) return null;

      let dataInicial = normalizeDate(row?.data_inicial ?? row?.inicio ?? row?.start_date);
      let dataFinal = normalizeDate(row?.data_final ?? row?.fim ?? row?.end_date);

      // Extract from referencia_semana or reference if start/end dates are missing
      const refSem = String(row?.referencia_semana ?? row?.referencia ?? "");
      if (refSem && (!dataInicial || !dataFinal)) {
        const dates = refSem.match(/\d{4}-\d{2}-\d{2}/g);
        if (dates) {
          if (!dataInicial) dataInicial = dates[0];
          if (!dataFinal && dates.length > 1) dataFinal = dates[1];
        }
      }

      return {
        ...row,
        data,
        ndvi: Number(ndvi.toFixed(4)),
        ndviMedio: Number(ndvi.toFixed(4)),
        dataInicial: dataInicial ?? undefined,
        dataFinal: dataFinal ?? undefined,
        referencia: String(
          row?.referencia_semana ?? row?.referencia_mes ?? row?.referencia ?? data,
        ),
        granularidade: inferGranularity(row, dataInicial ?? undefined, dataFinal ?? undefined),
      } satisfies NdviHistoryRow;
    })
    .filter((row): row is NdviHistoryRow => !!row);

  const weekly = uniqueSorted(
    allRows.filter((row) => row.granularidade === "weekly"),
    52,
  );
  const monthly = uniqueSorted(
    allRows.filter((row) => row.granularidade === "monthly"),
    12,
  );
  const all = uniqueSorted(allRows, 64);

  return { weekly, monthly, all };
}

export function buildHistoricalAverage(values: NdviHistoryRow[]): number[] {
  if (values.length === 0) return [];
  const avg = values.reduce((sum, item) => sum + item.ndviMedio, 0) / values.length;
  const rounded = Number(avg.toFixed(4));
  return values.map(() => rounded);
}

export function aggregateWeeklyToMonthly(weeklyRows: NdviHistoryRow[]): NdviHistoryRow[] {
  if (!weeklyRows || weeklyRows.length === 0) return [];

  // Group by "YYYY-MM"
  const groups = new Map<string, NdviHistoryRow[]>();
  for (const row of weeklyRows) {
    let monthKey = "";
    if (row.data && /^\d{4}-\d{2}/.test(row.data)) {
      monthKey = row.data.slice(0, 7); // "YYYY-MM"
    } else {
      const d = new Date(row.data);
      if (!Number.isNaN(d.getTime())) {
        monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      }
    }
    if (!monthKey) continue;
    if (!groups.has(monthKey)) {
      groups.set(monthKey, []);
    }
    groups.get(monthKey)!.push(row);
  }

  const result: NdviHistoryRow[] = [];
  for (const [monthKey, rows] of groups.entries()) {
    const sum = rows.reduce((acc, r) => acc + r.ndviMedio, 0);
    const avg = sum / rows.length;
    // Use the first day of that month for the date representation
    const dateStr = `${monthKey}-01`;
    result.push({
      data: dateStr,
      ndvi: Number(avg.toFixed(4)),
      ndviMedio: Number(avg.toFixed(4)),
      referencia: monthKey,
      granularidade: "monthly",
    });
  }

  // Sort by date ascending
  return result.sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime());
}

export function getLatestNdviAverage(dataset?: Partial<NdviDataset> | null): NdviHistoryRow | null {
  const monthly = dataset?.monthly ?? [];
  const weekly = dataset?.weekly ?? [];
  const all = dataset?.all ?? [];
  const preferred = monthly.length > 0 ? monthly : weekly.length > 0 ? weekly : all;
  return preferred.length > 0 ? preferred[preferred.length - 1] : null;
}
