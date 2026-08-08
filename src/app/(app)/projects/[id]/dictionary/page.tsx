"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";

type Entry = {
  id: string;
  entity_type: string;
  name: string;
  definition: string;
  source: string;
};

export default function DictionaryPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const [projectName, setProjectName] = useState("Project");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [message, setMessage] = useState("");

  async function refresh() {
    const [proj, dict] = await Promise.all([
      fetch(`/api/projects/${projectId}`).then((r) => r.json()),
      fetch(`/api/dictionary?projectId=${projectId}`).then((r) => r.json()),
    ]);
    setProjectName(proj.project?.name || "Project");
    setEntries(dict.entries || []);
  }

  useEffect(() => {
    refresh();
  }, [projectId]);

  const visible = useMemo(() => {
    return entries.filter((e) => {
      if (filter !== "all" && e.entity_type !== filter) return false;
      if (!q.trim()) return true;
      const hay = `${e.name} ${e.definition}`.toLowerCase();
      return hay.includes(q.toLowerCase());
    });
  }, [entries, filter, q]);

  async function rebuild() {
    const res = await fetch("/api/dictionary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId }),
    });
    const data = await res.json();
    setMessage(`Rebuilt dictionary with ${data.rebuilt} entries.`);
    refresh();
  }

  return (
    <AppShell projectId={projectId} projectName={projectName}>
      <div className="fade-up">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="brand-mark text-4xl">Data dictionary</h1>
            <p className="mt-2 max-w-2xl text-[var(--ink-soft)]">
              Auto-generated from connected tables, confirmed relationships, and uploaded ontology
              text — so the catalog is never blank once data is available.
            </p>
          </div>
          <button className="btn btn-sea" onClick={rebuild}>
            Rebuild from sources
          </button>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <input
            className="field max-w-sm"
            placeholder="Search dictionary…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select
            className="field max-w-xs"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">All types</option>
            <option value="table">Tables</option>
            <option value="column">Columns</option>
            <option value="relationship">Relationships</option>
            <option value="concept">Concepts</option>
          </select>
        </div>

        {message && <p className="mt-3 text-sm text-[var(--ok)]">{message}</p>}

        <div className="mt-6 overflow-x-auto rounded-xl border border-[var(--line)]">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[rgba(11,36,49,0.04)]">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Definition</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((e) => (
                <tr key={e.id} className="border-t border-[var(--line)] align-top">
                  <td className="px-4 py-3 font-medium">{e.name}</td>
                  <td className="px-4 py-3">
                    <span className="chip">{e.entity_type}</span>
                  </td>
                  <td className="px-4 py-3 text-[var(--ink-soft)]">{e.source}</td>
                  <td className="px-4 py-3 text-[var(--ink-soft)]">{e.definition}</td>
                </tr>
              ))}
              {!visible.length && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-[var(--ink-soft)]">
                    Dictionary is empty for this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
