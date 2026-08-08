"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";

type Connector = {
  id: string;
  name: string;
  type: string;
  status: string;
  last_sync_at: string | null;
};

const REMOTE_TYPES = [
  { value: "postgres", label: "PostgreSQL" },
  { value: "mysql", label: "MySQL" },
  { value: "mssql", label: "Microsoft SQL Server" },
  { value: "mongodb", label: "MongoDB (NoSQL)" },
  { value: "sqlite", label: "SQLite file" },
] as const;

export default function ConnectorsPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const [projectName, setProjectName] = useState("Project");
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [tab, setTab] = useState<"csv" | "remote">("csv");
  const [type, setType] = useState<string>("postgres");
  const [name, setName] = useState("");
  const [host, setHost] = useState("localhost");
  const [port, setPort] = useState("5432");
  const [database, setDatabase] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [uri, setUri] = useState("mongodb://localhost:27017");
  const [filepath, setFilepath] = useState("./data/local.sqlite");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const [proj, cons] = await Promise.all([
      fetch(`/api/projects/${projectId}`).then((r) => r.json()),
      fetch(`/api/connectors?projectId=${projectId}`).then((r) => r.json()),
    ]);
    setProjectName(proj.project?.name || "Project");
    setConnectors(cons.connectors || []);
  }

  useEffect(() => {
    refresh();
  }, [projectId]);

  async function uploadCsv(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    const form = e.currentTarget;
    const fd = new FormData(form);
    fd.set("projectId", projectId);
    const res = await fetch("/api/connectors", { method: "POST", body: fd });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Upload failed");
      return;
    }
    setMessage(
      `Ingested ${data.tableName}: ${data.rowCount} rows, ${data.columns} columns. Relationships re-inferred.`
    );
    form.reset();
    refresh();
  }

  async function connectRemote(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    const config: Record<string, string> =
      type === "mongodb"
        ? { uri, database }
        : type === "sqlite"
          ? { filepath }
          : { host, port, database, username, password };

    const res = await fetch("/api/connectors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        name: name || `${type} connector`,
        type,
        config,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Connection failed");
      return;
    }
    setMessage(data.test?.message || "Connector saved.");
    refresh();
  }

  return (
    <AppShell projectId={projectId} projectName={projectName}>
      <div className="fade-up">
        <h1 className="brand-mark text-4xl">Connectors</h1>
        <p className="mt-2 max-w-2xl text-[var(--ink-soft)]">
          Enable CSV uploads or register database connectors. Live remote drivers are stubbed
          safely in this demo; CSV and the retail seed fully populate the graph.
        </p>

        <div className="mt-6 flex gap-2 border-b border-[var(--line)]">
          <button
            className={`tab ${tab === "csv" ? "tab-active" : ""}`}
            onClick={() => setTab("csv")}
          >
            Upload CSV / local files
          </button>
          <button
            className={`tab ${tab === "remote" ? "tab-active" : ""}`}
            onClick={() => setTab("remote")}
          >
            Establish DB connection
          </button>
        </div>

        {tab === "csv" ? (
          <form onSubmit={uploadCsv} className="surface mt-6 max-w-xl space-y-4 rounded-2xl p-6">
            <label className="block text-sm font-medium">
              Connector name
              <input className="field mt-1" name="name" placeholder="Finance extracts" />
            </label>
            <label className="block text-sm font-medium">
              Table name (optional)
              <input className="field mt-1" name="tableName" placeholder="product_master" />
            </label>
            <label className="block text-sm font-medium">
              CSV file
              <input className="field mt-1" type="file" name="file" accept=".csv,text/csv" required />
            </label>
            <button className="btn btn-primary" disabled={busy}>
              {busy ? "Uploading…" : "Upload & profile"}
            </button>
          </form>
        ) : (
          <form onSubmit={connectRemote} className="surface mt-6 max-w-xl space-y-4 rounded-2xl p-6">
            <label className="block text-sm font-medium">
              Engine
              <select
                className="field mt-1"
                value={type}
                onChange={(e) => {
                  setType(e.target.value);
                  if (e.target.value === "mysql") setPort("3306");
                  if (e.target.value === "mssql") setPort("1433");
                  if (e.target.value === "postgres") setPort("5432");
                }}
              >
                {REMOTE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium">
              Display name
              <input
                className="field mt-1"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Warehouse prod"
              />
            </label>
            {type === "mongodb" ? (
              <>
                <input
                  className="field"
                  value={uri}
                  onChange={(e) => setUri(e.target.value)}
                  placeholder="mongodb://..."
                />
                <input
                  className="field"
                  value={database}
                  onChange={(e) => setDatabase(e.target.value)}
                  placeholder="database"
                  required
                />
              </>
            ) : type === "sqlite" ? (
              <input
                className="field"
                value={filepath}
                onChange={(e) => setFilepath(e.target.value)}
                placeholder="./path/to/db.sqlite"
                required
              />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  className="field"
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  placeholder="host"
                  required
                />
                <input
                  className="field"
                  value={port}
                  onChange={(e) => setPort(e.target.value)}
                  placeholder="port"
                  required
                />
                <input
                  className="field"
                  value={database}
                  onChange={(e) => setDatabase(e.target.value)}
                  placeholder="database"
                  required
                />
                <input
                  className="field"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="username"
                  required
                />
                <input
                  className="field sm:col-span-2"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="password"
                />
              </div>
            )}
            <button className="btn btn-sea" disabled={busy}>
              {busy ? "Saving…" : "Save connector"}
            </button>
          </form>
        )}

        {message && <p className="mt-4 text-sm text-[var(--ok)]">{message}</p>}
        {error && <p className="mt-4 text-sm text-[var(--danger)]">{error}</p>}

        <section className="mt-10">
          <h2 className="text-xl font-semibold">Enabled connectors</h2>
          <div className="mt-4 space-y-3">
            {connectors.map((c) => (
              <div key={c.id} className="surface flex flex-wrap items-center justify-between gap-3 rounded-xl p-4">
                <div>
                  <div className="font-semibold">{c.name}</div>
                  <div className="text-sm text-[var(--ink-soft)]">
                    {c.type} · synced {c.last_sync_at ? new Date(c.last_sync_at).toLocaleString() : "never"}
                  </div>
                </div>
                <span className={c.status === "connected" ? "chip chip-ok" : c.status === "error" ? "chip chip-danger" : "chip"}>
                  {c.status}
                </span>
              </div>
            ))}
            {!connectors.length && (
              <p className="text-[var(--ink-soft)]">No connectors yet.</p>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
