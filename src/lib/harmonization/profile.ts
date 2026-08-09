import { getDb } from "../db";
import type { ColumnMeta, TableMeta } from "../types";

export type VariableKind = "continuous" | "categorical" | "datetime" | "empty";

export interface FrequencyBucket {
  value: string;
  count: number;
  pct: number;
}

export interface ContinuousStats {
  count: number;
  missing: number;
  fill_rate: number;
  min: number;
  max: number;
  mean: number;
  median: number;
  std_dev: number;
  q1: number;
  q3: number;
  iqr: number;
  sum: number;
}

export interface CategoricalStats {
  count: number;
  missing: number;
  fill_rate: number;
  distinct: number;
  top_values: FrequencyBucket[];
  entropy: number;
  mode: string | null;
  mode_pct: number;
}

export interface ColumnProfile {
  column_id: string;
  name: string;
  declared_type: string;
  kind: VariableKind;
  fill_rate: number;
  null_count: number;
  non_null_count: number;
  sample_values: string[];
  continuous?: ContinuousStats;
  categorical?: CategoricalStats;
}

export interface CorrelationPair {
  a: string;
  b: string;
  coefficient: number;
  n: number;
}

export interface TableHarmonization {
  table_id: string;
  table_name: string;
  row_count: number;
  column_count: number;
  overall_fill_rate: number;
  continuous_columns: number;
  categorical_columns: number;
  columns: ColumnProfile[];
  correlations: CorrelationPair[];
}

export interface ProjectHarmonizationSummary {
  project_id: string;
  tables: {
    table_id: string;
    table_name: string;
    row_count: number;
    column_count: number;
    overall_fill_rate: number;
    continuous_columns: number;
    categorical_columns: number;
    weakest_fill_column: string | null;
    weakest_fill_rate: number | null;
  }[];
  totals: {
    tables: number;
    rows: number;
    columns: number;
    avg_fill_rate: number;
  };
}

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return NaN;
  if (sorted.length === 1) return sorted[0];
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  const w = idx - lo;
  return sorted[lo] * (1 - w) + sorted[hi] * w;
}

function stdDev(values: number[], mean: number): number {
  if (values.length < 2) return 0;
  let sumSq = 0;
  for (const v of values) {
    const d = v - mean;
    sumSq += d * d;
  }
  return Math.sqrt(sumSq / (values.length - 1));
}

function shannonEntropy(counts: number[], total: number): number {
  if (!total) return 0;
  let h = 0;
  for (const c of counts) {
    if (!c) continue;
    const p = c / total;
    h -= p * Math.log2(p);
  }
  return h;
}

function pearson(xs: number[], ys: number[]): { r: number; n: number } {
  const n = Math.min(xs.length, ys.length);
  if (n < 3) return { r: NaN, n };
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < n; i++) {
    sx += xs[i];
    sy += ys[i];
  }
  const mx = sx / n;
  const my = sy / n;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    const ax = xs[i] - mx;
    const ay = ys[i] - my;
    num += ax * ay;
    dx += ax * ax;
    dy += ay * ay;
  }
  const den = Math.sqrt(dx * dy);
  if (!den) return { r: 0, n };
  return { r: num / den, n };
}

function parseNumber(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  if (/^-?\d+(\.\d+)?([eE][-+]?\d+)?$/.test(t)) {
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function looksDatetime(values: string[]): boolean {
  const sample = values.slice(0, 40);
  if (!sample.length) return false;
  let hits = 0;
  for (const v of sample) {
    if (/^\d{4}-\d{2}-\d{2}/.test(v) || !Number.isNaN(Date.parse(v))) hits++;
  }
  return hits / sample.length >= 0.8;
}

function classifyColumn(
  declared: string,
  nonNull: string[]
): VariableKind {
  if (!nonNull.length) return "empty";
  const declaredLower = declared.toLowerCase();
  if (declaredLower.includes("date") || declaredLower.includes("time")) {
    return "datetime";
  }

  const numericHits = nonNull.filter((v) => parseNumber(v) !== null).length;
  const numericRatio = numericHits / nonNull.length;
  const distinct = new Set(nonNull).size;
  const distinctRatio = distinct / nonNull.length;

  if (numericRatio >= 0.9) {
    // IDs / codes with high cardinality stay categorical-ish if mostly unique integers
    if (distinctRatio > 0.95 && Number.isInteger(parseNumber(nonNull[0]) || 0.5)) {
      // still treat as continuous for min/max usefulness, correlations on ids are weak but ok
      return "continuous";
    }
    return "continuous";
  }

  if (looksDatetime(nonNull)) return "datetime";
  return "categorical";
}

function loadTableRows(tableId: string): Record<string, string>[] {
  const db = getDb();
  const rows = db
    .prepare(`SELECT row_json FROM table_rows WHERE table_id = ?`)
    .all(tableId) as { row_json: string }[];
  return rows.map((r) => JSON.parse(r.row_json) as Record<string, string>);
}

function profileColumn(
  column: ColumnMeta,
  rows: Record<string, string>[]
): ColumnProfile {
  const values = rows.map((r) => {
    const v = r[column.name];
    if (v === undefined || v === null) return "";
    return String(v);
  });
  const nonNull = values.filter((v) => v.trim() !== "");
  const missing = values.length - nonNull.length;
  const fill_rate = values.length ? nonNull.length / values.length : 0;
  const kind = classifyColumn(column.data_type, nonNull);
  const sample_values = [...new Set(nonNull)].slice(0, 8);

  const base: ColumnProfile = {
    column_id: column.id,
    name: column.name,
    declared_type: column.data_type,
    kind,
    fill_rate,
    null_count: missing,
    non_null_count: nonNull.length,
    sample_values,
  };

  if (kind === "continuous") {
    const nums = nonNull
      .map((v) => parseNumber(v))
      .filter((n): n is number => n !== null)
      .sort((a, b) => a - b);
    if (nums.length) {
      const sum = nums.reduce((a, b) => a + b, 0);
      const mean = sum / nums.length;
      const q1 = percentile(nums, 0.25);
      const q3 = percentile(nums, 0.75);
      base.continuous = {
        count: nums.length,
        missing,
        fill_rate: values.length ? nums.length / values.length : 0,
        min: nums[0],
        max: nums[nums.length - 1],
        mean,
        median: percentile(nums, 0.5),
        std_dev: stdDev(nums, mean),
        q1,
        q3,
        iqr: q3 - q1,
        sum,
      };
    }
  } else if (kind === "categorical" || kind === "datetime") {
    const freq = new Map<string, number>();
    for (const v of nonNull) freq.set(v, (freq.get(v) || 0) + 1);
    const sorted = [...freq.entries()].sort((a, b) => b[1] - a[1]);
    const top = sorted.slice(0, 15).map(([value, count]) => ({
      value,
      count,
      pct: nonNull.length ? count / nonNull.length : 0,
    }));
    const mode = top[0]?.value ?? null;
    base.categorical = {
      count: nonNull.length,
      missing,
      fill_rate,
      distinct: freq.size,
      top_values: top,
      entropy: shannonEntropy(
        sorted.map(([, c]) => c),
        nonNull.length
      ),
      mode,
      mode_pct: top[0]?.pct ?? 0,
    };
  }

  return base;
}

function computeCorrelations(
  columns: ColumnProfile[],
  rows: Record<string, string>[]
): CorrelationPair[] {
  const continuous = columns.filter((c) => c.kind === "continuous" && c.continuous);
  const pairs: CorrelationPair[] = [];
  for (let i = 0; i < continuous.length; i++) {
    for (let j = i + 1; j < continuous.length; j++) {
      const a = continuous[i];
      const b = continuous[j];
      const xs: number[] = [];
      const ys: number[] = [];
      for (const row of rows) {
        const xv = parseNumber(String(row[a.name] ?? ""));
        const yv = parseNumber(String(row[b.name] ?? ""));
        if (xv === null || yv === null) continue;
        xs.push(xv);
        ys.push(yv);
      }
      const { r, n } = pearson(xs, ys);
      if (!Number.isFinite(r) || n < 3) continue;
      pairs.push({ a: a.name, b: b.name, coefficient: r, n });
    }
  }
  return pairs.sort((x, y) => Math.abs(y.coefficient) - Math.abs(x.coefficient));
}

export function harmonizeTable(tableId: string): TableHarmonization | null {
  const db = getDb();
  const table = db
    .prepare(`SELECT * FROM tables_meta WHERE id = ?`)
    .get(tableId) as TableMeta | undefined;
  if (!table) return null;

  const columns = db
    .prepare(`SELECT * FROM columns_meta WHERE table_id = ? ORDER BY name`)
    .all(tableId) as ColumnMeta[];
  const rows = loadTableRows(tableId);
  const profiles = columns.map((c) => profileColumn(c, rows));

  const fillRates = profiles.map((p) => p.fill_rate);
  const overall =
    fillRates.length === 0
      ? 0
      : fillRates.reduce((a, b) => a + b, 0) / fillRates.length;

  return {
    table_id: table.id,
    table_name: table.name,
    row_count: rows.length || table.row_count,
    column_count: columns.length,
    overall_fill_rate: overall,
    continuous_columns: profiles.filter((p) => p.kind === "continuous").length,
    categorical_columns: profiles.filter((p) => p.kind === "categorical").length,
    columns: profiles,
    correlations: computeCorrelations(profiles, rows),
  };
}

export function harmonizeProject(projectId: string): ProjectHarmonizationSummary {
  const db = getDb();
  const tables = db
    .prepare(`SELECT * FROM tables_meta WHERE project_id = ? ORDER BY name`)
    .all(projectId) as TableMeta[];

  const summaries = tables.map((t) => {
    const full = harmonizeTable(t.id);
    if (!full) {
      return {
        table_id: t.id,
        table_name: t.name,
        row_count: t.row_count,
        column_count: 0,
        overall_fill_rate: 0,
        continuous_columns: 0,
        categorical_columns: 0,
        weakest_fill_column: null,
        weakest_fill_rate: null,
      };
    }
    const weakest = [...full.columns].sort((a, b) => a.fill_rate - b.fill_rate)[0];
    return {
      table_id: full.table_id,
      table_name: full.table_name,
      row_count: full.row_count,
      column_count: full.column_count,
      overall_fill_rate: full.overall_fill_rate,
      continuous_columns: full.continuous_columns,
      categorical_columns: full.categorical_columns,
      weakest_fill_column: weakest?.name ?? null,
      weakest_fill_rate: weakest?.fill_rate ?? null,
    };
  });

  const avgFill = summaries.length
    ? summaries.reduce((a, b) => a + b.overall_fill_rate, 0) / summaries.length
    : 0;

  return {
    project_id: projectId,
    tables: summaries,
    totals: {
      tables: summaries.length,
      rows: summaries.reduce((a, b) => a + b.row_count, 0),
      columns: summaries.reduce((a, b) => a + b.column_count, 0),
      avg_fill_rate: avgFill,
    },
  };
}
