"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";

type Rel = {
  id: string;
  source_table: string;
  source_column: string;
  target_table: string;
  target_column: string;
  confidence: number;
  overlap_ratio: number;
  shared_values: number;
  status: string;
  rationale: string;
  source_table_id: string;
  source_column_id: string;
  target_table_id: string;
  target_column_id: string;
};

type Col = { id: string; table_id: string; name: string };
type Table = { id: string; name: string };

export default function RelationshipsPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const [projectName, setProjectName] = useState("Project");
  const [rels, setRels] = useState<Rel[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [columns, setColumns] = useState<Col[]>([]);
  const [tab, setTab] = useState<"suggest" | "sql" | "manual">("suggest");
  const [sql, setSql] = useState(
    `SELECT s.sale_id, p.product_name, c.full_name\nFROM sales_fact s\nJOIN product_master p ON s.product_id = p.product_id\nJOIN consumer_master c ON s.consumer_id = c.consumer_id;`
  );
  const [message, setMessage] = useState("");
  const [sourceTableId, setSourceTableId] = useState("");
  const [sourceColumnId, setSourceColumnId] = useState("");
  const [targetTableId, setTargetTableId] = useState("");
  const [targetColumnId, setTargetColumnId] = useState("");

  const sourceCols = useMemo(
    () => columns.filter((c) => c.table_id === sourceTableId),
    [columns, sourceTableId]
  );
  const targetCols = useMemo(
    () => columns.filter((c) => c.table_id === targetTableId),
    [columns, targetTableId]
  );

  async function refresh() {
    const [proj, relationships] = await Promise.all([
      fetch(`/api/projects/${projectId}`).then((r) => r.json()),
      fetch(`/api/relationships?projectId=${projectId}`).then((r) => r.json()),
    ]);
    setProjectName(proj.project?.name || "Project");
    setTables(proj.tables || []);
    setColumns(proj.columns || []);
    setRels(relationships.relationships || []);
    if (!sourceTableId && proj.tables?.[0]) setSourceTableId(proj.tables[0].id);
    if (!targetTableId && proj.tables?.[1]) setTargetTableId(proj.tables[1].id);
  }

  useEffect(() => {
    refresh();
  }, [projectId]);

  async function setStatus(id: string, status: string) {
    await fetch("/api/relationships", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    refresh();
  }

  async function infer() {
    setMessage("");
    const res = await fetch("/api/relationships", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, action: "infer", minOverlap: 0.5 }),
    });
    const data = await res.json();
    setMessage(`Found ${data.created} suggested connections from value overlap.`);
    refresh();
  }

  async function uploadSql(e: FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/relationships", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, action: "sql", sql }),
    });
    const data = await res.json();
    setMessage(`Parsed ${data.created} relationships from SQL.`);
    refresh();
  }

  async function createManual(e: FormEvent) {
    e.preventDefault();
    await fetch("/api/relationships", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        action: "manual",
        sourceTableId,
        sourceColumnId,
        targetTableId,
        targetColumnId,
      }),
    });
    setMessage("Manual connection saved.");
    refresh();
  }

  return (
    <AppShell projectId={projectId} projectName={projectName}>
      <div className="fade-up">
        <h1 className="brand-mark text-4xl">Relationships</h1>
        <p className="mt-2 max-w-3xl text-[var(--ink-soft)]">
          GraphLoom suggests joins when values overlap — for example if most of{" "}
          <code>table1.xid</code> also appears in <code>table2.yid</code>. Confirm, reject, upload
          SQL, or define connections manually.
        </p>

        <div className="mt-6 flex flex-wrap gap-2 border-b border-[var(--line)]">
          {(
            [
              ["suggest", "Suggested matches"],
              ["sql", "Upload SQL"],
              ["manual", "Establish connection"],
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

        {tab === "suggest" && (
          <div className="mt-6">
            <button className="btn btn-sea" onClick={infer}>
              Re-scan for matches
            </button>
            <div className="mt-6 space-y-3">
              {rels.map((r) => (
                <div key={r.id} className="surface rounded-xl p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold">
                        {r.source_table}.{r.source_column} → {r.target_table}.{r.target_column}
                      </div>
                      <p className="mt-1 text-sm text-[var(--ink-soft)]">{r.rationale}</p>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs">
                        <span className="chip">
                          {Math.round(r.confidence * 100)}% confidence
                        </span>
                        <span className="chip">
                          {Math.round(r.overlap_ratio * 100)}% overlap · {r.shared_values} shared
                        </span>
                        <span
                          className={
                            r.status === "confirmed" || r.status === "manual"
                              ? "chip chip-ok"
                              : r.status === "rejected"
                                ? "chip chip-danger"
                                : "chip chip-warn"
                          }
                        >
                          {r.status}
                        </span>
                      </div>
                    </div>
                    {r.status === "suggested" && (
                      <div className="flex gap-2">
                        <button
                          className="btn btn-primary py-2"
                          onClick={() => setStatus(r.id, "confirmed")}
                        >
                          Confirm
                        </button>
                        <button
                          className="btn btn-ghost py-2"
                          onClick={() => setStatus(r.id, "rejected")}
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {!rels.length && (
                <p className="text-[var(--ink-soft)]">
                  No relationships yet. Connect data, then re-scan.
                </p>
              )}
            </div>
          </div>
        )}

        {tab === "sql" && (
          <form onSubmit={uploadSql} className="surface mt-6 max-w-3xl space-y-4 rounded-2xl p-6">
            <label className="block text-sm font-medium">
              SQL with JOINs or FOREIGN KEY clauses
              <textarea
                className="field mt-1 min-h-48 font-mono text-sm"
                value={sql}
                onChange={(e) => setSql(e.target.value)}
              />
            </label>
            <button className="btn btn-primary">Parse SQL connections</button>
          </form>
        )}

        {tab === "manual" && (
          <form onSubmit={createManual} className="surface mt-6 max-w-2xl space-y-4 rounded-2xl p-6">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-medium">
                Source table
                <select
                  className="field mt-1"
                  value={sourceTableId}
                  onChange={(e) => {
                    setSourceTableId(e.target.value);
                    setSourceColumnId("");
                  }}
                >
                  {tables.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-medium">
                Source column
                <select
                  className="field mt-1"
                  value={sourceColumnId}
                  onChange={(e) => setSourceColumnId(e.target.value)}
                  required
                >
                  <option value="">Select…</option>
                  {sourceCols.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-medium">
                Target table
                <select
                  className="field mt-1"
                  value={targetTableId}
                  onChange={(e) => {
                    setTargetTableId(e.target.value);
                    setTargetColumnId("");
                  }}
                >
                  {tables.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-medium">
                Target column
                <select
                  className="field mt-1"
                  value={targetColumnId}
                  onChange={(e) => setTargetColumnId(e.target.value)}
                  required
                >
                  <option value="">Select…</option>
                  {targetCols.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <button className="btn btn-sea">Save connection</button>
          </form>
        )}

        {message && <p className="mt-4 text-sm text-[var(--ok)]">{message}</p>}
      </div>
    </AppShell>
  );
}
