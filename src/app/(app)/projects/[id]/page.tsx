"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";

export default function ProjectOverviewPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<{
    project: { id: string; name: string; description: string; is_demo: number };
    connectors: unknown[];
    tables: { id: string; name: string; row_count: number; description: string | null }[];
    columns: unknown[];
  } | null>(null);

  useEffect(() => {
    fetch(`/api/projects/${params.id}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null));
  }, [params.id]);

  if (!data?.project) {
    return (
      <AppShell>
        <p>Loading project…</p>
      </AppShell>
    );
  }

  const { project, tables, connectors } = data;

  return (
    <AppShell projectId={project.id} projectName={project.name}>
      <div className="fade-up">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="brand-mark text-4xl md:text-5xl">{project.name}</h1>
            <p className="mt-2 max-w-2xl text-[var(--ink-soft)]">{project.description}</p>
          </div>
          <Link href={`/projects/${project.id}/graph`} className="btn btn-primary">
            Open knowledge graph
          </Link>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {[
            ["Connectors", connectors.length, `/projects/${project.id}/connectors`],
            ["Tables", tables.length, `/projects/${project.id}/connectors`],
            ["Next step", "Confirm joins", `/projects/${project.id}/relationships`],
          ].map(([label, value, href]) => (
            <Link key={String(label)} href={String(href)} className="surface rounded-xl p-5">
              <div className="text-sm uppercase tracking-[0.12em] text-[var(--sea)]">
                {label}
              </div>
              <div className="mt-2 text-2xl font-semibold">{value}</div>
            </Link>
          ))}
        </div>

        <section className="mt-10">
          <h2 className="text-xl font-semibold">Tables in this project</h2>
          <div className="mt-4 overflow-x-auto rounded-xl border border-[var(--line)]">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[rgba(11,36,49,0.04)]">
                <tr>
                  <th className="px-4 py-3 font-semibold">Table</th>
                  <th className="px-4 py-3 font-semibold">Rows</th>
                  <th className="px-4 py-3 font-semibold">Description</th>
                </tr>
              </thead>
              <tbody>
                {tables.map((t) => (
                  <tr key={t.id} className="border-t border-[var(--line)]">
                    <td className="px-4 py-3 font-medium">{t.name}</td>
                    <td className="px-4 py-3">{t.row_count}</td>
                    <td className="px-4 py-3 text-[var(--ink-soft)]">
                      {t.description || "—"}
                    </td>
                  </tr>
                ))}
                {!tables.length && (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-[var(--ink-soft)]">
                      No tables yet. Add a connector or upload CSV.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
