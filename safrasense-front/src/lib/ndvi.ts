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

  const parsed = new Date(String(value));
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return String(value);
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

      const dataInicial = normalizeDate(row?.data_inicial ?? row?.inicio ?? row?.start_date);
      const dataFinal = normalizeDate(row?.data_final ?? row?.fim ?? row?.end_date);

      return {
        ...row,
        data,
        ndvi: Number(ndvi.toFixed(4)),
        ndviMedio: Number(ndvi.toFixed(4)),
        dataInicial: dataInicial ?? undefined,
        dataFinal: dataFinal ?? undefined,
        referencia: String(row?.referencia_semana ?? row?.referencia_mes ?? row?.referencia ?? data),
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

export function getLatestNdviAverage(dataset?: Partial<NdviDataset> | null): NdviHistoryRow | null {
  const monthly = dataset?.monthly ?? [];
  const weekly = dataset?.weekly ?? [];
  const all = dataset?.all ?? [];
  const preferred = monthly.length > 0 ? monthly : weekly.length > 0 ? weekly : all;
  return preferred.length > 0 ? preferred[preferred.length - 1] : null;
}