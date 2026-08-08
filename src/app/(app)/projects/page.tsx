"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";

type Project = {
  id: string;
  name: string;
  description: string;
  is_demo: number;
  connector_count: number;
  table_count: number;
  relationship_count: number;
  updated_at: string;
};

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const res = await fetch("/api/projects");
    if (!res.ok) return;
    const data = await res.json();
    setProjects(data.projects || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function createProject(e: FormEvent, withDemo = false) {
    e.preventDefault();
    setCreating(true);
    setError("");
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: withDemo ? "Retail Store Demo" : name,
        description,
        withDemo,
      }),
    });
    const data = await res.json();
    setCreating(false);
    if (!res.ok) {
      setError(data.error || "Could not create project");
      return;
    }
    setName("");
    setDescription("");
    await load();
  }

  return (
    <AppShell>
      <div className="fade-up grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        <section>
          <h1 className="brand-mark text-4xl md:text-5xl">Projects</h1>
          <p className="mt-2 max-w-2xl text-[var(--ink-soft)]">
            Each project is an isolated knowledge graph workspace with its own connectors,
            relationships, ontology, and dictionary.
          </p>

          {loading ? (
            <p className="mt-8 text-[var(--ink-soft)]">Loading projects…</p>
          ) : (
            <div className="mt-8 space-y-4">
              {projects.map((p, idx) => (
                <Link
                  key={p.id}
                  href={`/projects/${p.id}`}
                  className="surface block rounded-xl p-5 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow)]"
                  style={{ animationDelay: `${idx * 60}ms` }}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-semibold">{p.name}</h2>
                      <p className="mt-1 text-sm text-[var(--ink-soft)]">
                        {p.description || "No description yet."}
                      </p>
                    </div>
                    {p.is_demo ? <span className="chip">demo retail</span> : null}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-3 text-sm text-[var(--ink-soft)]">
                    <span>{p.connector_count} connectors</span>
                    <span>·</span>
                    <span>{p.table_count} tables</span>
                    <span>·</span>
                    <span>{p.relationship_count} relationships</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <aside className="surface h-fit rounded-2xl p-6 shadow-[var(--shadow)]">
          <h2 className="text-lg font-semibold">New project</h2>
          <form onSubmit={(e) => createProject(e, false)} className="mt-4 space-y-3">
            <input
              className="field"
              placeholder="Project name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <textarea
              className="field min-h-24"
              placeholder="What business domain does this graph cover?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <button className="btn btn-primary w-full" disabled={creating}>
              Create blank project
            </button>
          </form>
          <button
            className="btn btn-sea mt-3 w-full"
            disabled={creating}
            onClick={(e) => createProject(e as unknown as FormEvent, true)}
          >
            Add another retail demo
          </button>
          {error && <p className="mt-3 text-sm text-[var(--danger)]">{error}</p>}
        </aside>
      </div>
    </AppShell>
  );
}
