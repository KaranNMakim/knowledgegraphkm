"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";

type SummaryTable = {
  table_id: string;
  table_name: string;
  row_count: number;
  column_count: number;
  overall_fill_rate: number;
  continuous_columns: number;
  categorical_columns: number;
  weakest_fill_column: string | null;
  weakest_fill_rate: number | null;
};

type ColumnProfile = {
  column_id: string;
  name: string;
  declared_type: string;
  kind: string;
  fill_rate: number;
  null_count: number;
  non_null_count: number;
  sample_values: string[];
  continuous?: {
    min: number;
    max: number;
    mean: number;
    median: number;
    std_dev: number;
    q1: number;
    q3: number;
    iqr: number;
    count: number;
  };
  categorical?: {
    distinct: number;
    entropy: number;
    mode: string | null;
    mode_pct: number;
    top_values: { value: string; count: number; pct: number }[];
  };
};

type TableDetail = {
  table_id: string;
  table_name: string;
  row_count: number;
  column_count: number;
  overall_fill_rate: number;
  continuous_columns: number;
  categorical_columns: number;
  columns: ColumnProfile[];
  correlations: { a: string; b: string; coefficient: number; n: number }[];
};

function pct(n: number) {
  return `${Math.round(n * 1000) / 10}%`;
}

function num(n: number | undefined) {
  if (n === undefined || Number.isNaN(n)) return "—";
  if (Math.abs(n) >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

export default function HarmonizationPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const [projectName, setProjectName] = useState("Project");
  const [tables, setTables] = useState<SummaryTable[]>([]);
  const [totals, setTotals] = useState({
    tables: 0,
    rows: 0,
    columns: 0,
    avg_fill_rate: 0,
  });
  const [selectedTableId, setSelectedTableId] = useState("");
  const [detail, setDetail] = useState<TableDetail | null>(null);
  const [tab, setTab] = useState<"summary" | "columns" | "distributions" | "correlations">(
    "summary"
  );
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  async function loadSummary() {
    setLoading(true);
    const [proj, harm] = await Promise.all([
      fetch(`/api/projects/${projectId}`).then((r) => r.json()),
      fetch(`/api/harmonization?projectId=${projectId}`).then((r) => r.json()),
    ]);
    setProjectName(proj.project?.name || "Project");
    const list = harm.summary?.tables || [];
    setTables(list);
    setTotals(
      harm.summary?.totals || { tables: 0, rows: 0, columns: 0, avg_fill_rate: 0 }
    );
    if (!selectedTableId && list[0]) setSelectedTableId(list[0].table_id);
    setLoading(false);
  }

  async function loadTable(tableId: string) {
    if (!tableId) return;
    setBusy(true);
    const res = await fetch(
      `/api/harmonization?projectId=${projectId}&tableId=${tableId}`
    );
    const data = await res.json();
    setDetail(data.table || null);
    setBusy(false);
  }

  useEffect(() => {
    loadSummary();
  }, [projectId]);

  useEffect(() => {
    if (selectedTableId) loadTable(selectedTableId);
  }, [selectedTableId, projectId]);

  const continuousCols = useMemo(
    () => detail?.columns.filter((c) => c.kind === "continuous") || [],
    [detail]
  );
  const categoricalCols = useMemo(
    () =>
      detail?.columns.filter(
        (c) => c.kind === "categorical" || c.kind === "datetime"
      ) || [],
    [detail]
  );

  return (
    <AppShell projectId={projectId} projectName={projectName}>
      <div className="fade-up">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="brand-mark text-4xl">Data harmonization</h1>
            <p className="mt-2 max-w-3xl text-[var(--ink-soft)]">
              Profile connected tables with fill rates, continuous-variable statistics,
              categorical frequency distributions, and pairwise correlations — a readiness
              suite before graph mapping.
            </p>
          </div>
          <button className="btn btn-sea" onClick={() => { loadSummary(); if (selectedTableId) loadTable(selectedTableId); }}>
            Refresh profiles
          </button>
        </div>

        {loading ? (
          <p className="mt-8 text-[var(--ink-soft)]">Profiling project…</p>
        ) : (
          <>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["Tables", totals.tables],
                ["Rows profiled", totals.rows.toLocaleString()],
                ["Columns", totals.columns],
                ["Avg fill rate", pct(totals.avg_fill_rate)],
              ].map(([label, value]) => (
                <div key={String(label)} className="surface rounded-xl p-5">
                  <div className="text-sm uppercase tracking-[0.12em] text-[var(--sea)]">
                    {label}
                  </div>
                  <div className="mt-2 text-2xl font-semibold">{value}</div>
                </div>
              ))}
            </div>

            <section className="mt-10">
              <h2 className="text-xl font-semibold">Table fill summary</h2>
              <div className="mt-4 overflow-x-auto rounded-xl border border-[var(--line)]">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-[rgba(11,36,49,0.04)]">
                    <tr>
                      <th className="px-4 py-3">Table</th>
                      <th className="px-4 py-3">Rows</th>
                      <th className="px-4 py-3">Columns</th>
                      <th className="px-4 py-3">Fill rate</th>
                      <th className="px-4 py-3">Continuous</th>
                      <th className="px-4 py-3">Categorical</th>
                      <th className="px-4 py-3">Weakest column</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tables.map((t) => (
                      <tr
                        key={t.table_id}
                        className={`border-t border-[var(--line)] cursor-pointer ${
                          selectedTableId === t.table_id ? "bg-[rgba(15,107,98,0.08)]" : ""
                        }`}
                        onClick={() => {
                          setSelectedTableId(t.table_id);
                          setTab("summary");
                        }}
                      >
                        <td className="px-4 py-3 font-medium">{t.table_name}</td>
                        <td className="px-4 py-3">{t.row_count}</td>
                        <td className="px-4 py-3">{t.column_count}</td>
                        <td className="px-4 py-3">
                          <span className={t.overall_fill_rate < 0.9 ? "chip chip-warn" : "chip chip-ok"}>
                            {pct(t.overall_fill_rate)}
                          </span>
                        </td>
                        <td className="px-4 py-3">{t.continuous_columns}</td>
                        <td className="px-4 py-3">{t.categorical_columns}</td>
                        <td className="px-4 py-3 text-[var(--ink-soft)]">
                          {t.weakest_fill_column
                            ? `${t.weakest_fill_column} (${pct(t.weakest_fill_rate || 0)})`
                            : "—"}
                        </td>
                      </tr>
                    ))}
                    {!tables.length && (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-[var(--ink-soft)]">
                          No tables to profile yet. Connect data first.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            {selectedTableId && (
              <section className="mt-10">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-xl font-semibold">
                    Table detail{detail ? `: ${detail.table_name}` : ""}
                  </h2>
                  <select
                    className="field max-w-xs"
                    value={selectedTableId}
                    onChange={(e) => setSelectedTableId(e.target.value)}
                  >
                    {tables.map((t) => (
                      <option key={t.table_id} value={t.table_id}>
                        {t.table_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mt-4 flex flex-wrap gap-2 border-b border-[var(--line)]">
                  {(
                    [
                      ["summary", "Column summary"],
                      ["columns", "Continuous stats"],
                      ["distributions", "Categorical frequencies"],
                      ["correlations", "Correlations"],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      className={`tab ${tab === id ? "tab-active" : ""}`}
                      onClick={() => setTab(id)}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {busy && !detail ? (
                  <p className="mt-6 text-[var(--ink-soft)]">Computing statistics…</p>
                ) : detail ? (
                  <div className="mt-6">
                    {tab === "summary" && (
                      <div className="overflow-x-auto rounded-xl border border-[var(--line)]">
                        <table className="min-w-full text-left text-sm">
                          <thead className="bg-[rgba(11,36,49,0.04)]">
                            <tr>
                              <th className="px-4 py-3">Column</th>
                              <th className="px-4 py-3">Kind</th>
                              <th className="px-4 py-3">Fill rate</th>
                              <th className="px-4 py-3">Non-null</th>
                              <th className="px-4 py-3">Missing</th>
                              <th className="px-4 py-3">Notes</th>
                            </tr>
                          </thead>
                          <tbody>
                            {detail.columns.map((c) => (
                              <tr key={c.column_id} className="border-t border-[var(--line)]">
                                <td className="px-4 py-3 font-medium">{c.name}</td>
                                <td className="px-4 py-3">
                                  <span className="chip">{c.kind}</span>
                                </td>
                                <td className="px-4 py-3">{pct(c.fill_rate)}</td>
                                <td className="px-4 py-3">{c.non_null_count}</td>
                                <td className="px-4 py-3">{c.null_count}</td>
                                <td className="px-4 py-3 text-[var(--ink-soft)]">
                                  {c.kind === "continuous" && c.continuous
                                    ? `min ${num(c.continuous.min)} · max ${num(c.continuous.max)} · mean ${num(c.continuous.mean)}`
                                    : c.categorical
                                      ? `${c.categorical.distinct} distinct · mode ${c.categorical.mode ?? "—"}`
                                      : c.sample_values.slice(0, 3).join(", ") || "—"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {tab === "columns" && (
                      <div className="overflow-x-auto rounded-xl border border-[var(--line)]">
                        <table className="min-w-full text-left text-sm">
                          <thead className="bg-[rgba(11,36,49,0.04)]">
                            <tr>
                              <th className="px-4 py-3">Column</th>
                              <th className="px-4 py-3">Count</th>
                              <th className="px-4 py-3">Min</th>
                              <th className="px-4 py-3">Max</th>
                              <th className="px-4 py-3">Mean</th>
                              <th className="px-4 py-3">Median</th>
                              <th className="px-4 py-3">Std dev</th>
                              <th className="px-4 py-3">Q1</th>
                              <th className="px-4 py-3">Q3</th>
                              <th className="px-4 py-3">IQR</th>
                            </tr>
                          </thead>
                          <tbody>
                            {continuousCols.map((c) => (
                              <tr key={c.column_id} className="border-t border-[var(--line)]">
                                <td className="px-4 py-3 font-medium">{c.name}</td>
                                <td className="px-4 py-3">{c.continuous?.count}</td>
                                <td className="px-4 py-3">{num(c.continuous?.min)}</td>
                                <td className="px-4 py-3">{num(c.continuous?.max)}</td>
                                <td className="px-4 py-3">{num(c.continuous?.mean)}</td>
                                <td className="px-4 py-3">{num(c.continuous?.median)}</td>
                                <td className="px-4 py-3">{num(c.continuous?.std_dev)}</td>
                                <td className="px-4 py-3">{num(c.continuous?.q1)}</td>
                                <td className="px-4 py-3">{num(c.continuous?.q3)}</td>
                                <td className="px-4 py-3">{num(c.continuous?.iqr)}</td>
                              </tr>
                            ))}
                            {!continuousCols.length && (
                              <tr>
                                <td colSpan={10} className="px-4 py-8 text-[var(--ink-soft)]">
                                  No continuous variables detected in this table.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {tab === "distributions" && (
                      <div className="grid gap-4 lg:grid-cols-2">
                        {categoricalCols.map((c) => (
                          <div key={c.column_id} className="surface rounded-xl p-5">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <h3 className="font-semibold">{c.name}</h3>
                              <span className="chip">
                                {c.categorical?.distinct ?? 0} distinct · H=
                                {num(c.categorical?.entropy)}
                              </span>
                            </div>
                            <p className="mt-1 text-sm text-[var(--ink-soft)]">
                              Mode: {c.categorical?.mode ?? "—"} (
                              {pct(c.categorical?.mode_pct || 0)})
                            </p>
                            <div className="mt-4 space-y-2">
                              {(c.categorical?.top_values || []).slice(0, 8).map((b) => (
                                <div key={b.value}>
                                  <div className="mb-1 flex justify-between gap-2 text-xs">
                                    <span className="truncate font-medium">{b.value || "(empty)"}</span>
                                    <span className="text-[var(--ink-soft)]">
                                      {b.count} · {pct(b.pct)}
                                    </span>
                                  </div>
                                  <div className="h-2 overflow-hidden rounded bg-[rgba(11,36,49,0.08)]">
                                    <div
                                      className="h-full rounded bg-[var(--sea)]"
                                      style={{ width: `${Math.max(2, b.pct * 100)}%` }}
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                        {!categoricalCols.length && (
                          <p className="text-[var(--ink-soft)]">
                            No categorical variables detected in this table.
                          </p>
                        )}
                      </div>
                    )}

                    {tab === "correlations" && (
                      <div className="overflow-x-auto rounded-xl border border-[var(--line)]">
                        <table className="min-w-full text-left text-sm">
                          <thead className="bg-[rgba(11,36,49,0.04)]">
                            <tr>
                              <th className="px-4 py-3">Variable A</th>
                              <th className="px-4 py-3">Variable B</th>
                              <th className="px-4 py-3">Pearson r</th>
                              <th className="px-4 py-3">|r|</th>
                              <th className="px-4 py-3">Paired n</th>
                            </tr>
                          </thead>
                          <tbody>
                            {detail.correlations.map((c) => (
                              <tr key={`${c.a}-${c.b}`} className="border-t border-[var(--line)]">
                                <td className="px-4 py-3 font-medium">{c.a}</td>
                                <td className="px-4 py-3 font-medium">{c.b}</td>
                                <td className="px-4 py-3">{num(c.coefficient)}</td>
                                <td className="px-4 py-3">
                                  <span
                                    className={
                                      Math.abs(c.coefficient) >= 0.7
                                        ? "chip chip-ok"
                                        : Math.abs(c.coefficient) >= 0.4
                                          ? "chip chip-warn"
                                          : "chip"
                                    }
                                  >
                                    {num(Math.abs(c.coefficient))}
                                  </span>
                                </td>
                                <td className="px-4 py-3">{c.n}</td>
                              </tr>
                            ))}
                            {!detail.correlations.length && (
                              <tr>
                                <td colSpan={5} className="px-4 py-8 text-[var(--ink-soft)]">
                                  Need at least two continuous columns with overlapping numeric values.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ) : null}
              </section>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
