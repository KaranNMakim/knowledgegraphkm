"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";

const SAMPLE = `Product: The sellable item sold in stores. Maps to table product_master.
Consumer: A loyalty shopper or household. Maps to table consumer_master.
Date: Calendar spine used for sales and promotions. Maps to table date_master.
Promotion: Time-bounded offer applied to baskets. Maps to table promotion_master.
Store: Physical or express retail location. Maps to table store_master.
Sales: Transactional fact linking product, consumer, date, store, and optional promo.
product_id links sales to product
consumer_id connects sales to consumer
promo_id relates sales to promotion`;

export default function OntologyPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const [projectName, setProjectName] = useState("Project");
  const [text, setText] = useState(SAMPLE);
  const [entries, setEntries] = useState<
    { id: string; raw_text: string; parsed_json: string; created_at: string }[]
  >([]);
  const [message, setMessage] = useState("");

  async function refresh() {
    const [proj, onto] = await Promise.all([
      fetch(`/api/projects/${projectId}`).then((r) => r.json()),
      fetch(`/api/ontology?projectId=${projectId}`).then((r) => r.json()),
    ]);
    setProjectName(proj.project?.name || "Project");
    setEntries(onto.entries || []);
  }

  useEffect(() => {
    refresh();
  }, [projectId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/ontology", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, text }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error || "Failed");
      return;
    }
    setMessage(
      `Parsed ${data.parsed?.concepts?.length || 0} concepts from plain-English ontology.`
    );
    refresh();
  }

  return (
    <AppShell projectId={projectId} projectName={projectName}>
      <div className="fade-up grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <section>
          <h1 className="brand-mark text-4xl">Ontology</h1>
          <p className="mt-2 text-[var(--ink-soft)]">
            Upload a data dictionary or domain description in plain English. GraphLoom extracts
            concepts and maps them onto known tables and columns.
          </p>
          <form onSubmit={onSubmit} className="surface mt-6 space-y-4 rounded-2xl p-6">
            <textarea
              className="field min-h-80"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <button className="btn btn-primary">Parse ontology</button>
          </form>
          {message && <p className="mt-3 text-sm text-[var(--ok)]">{message}</p>}
        </section>

        <aside>
          <h2 className="text-lg font-semibold">Recent uploads</h2>
          <div className="mt-4 space-y-4">
            {entries.map((e) => {
              const parsed = JSON.parse(e.parsed_json || "{}") as {
                concepts?: { name: string; definition: string }[];
              };
              return (
                <div key={e.id} className="surface rounded-xl p-4">
                  <div className="text-xs text-[var(--ink-soft)]">
                    {new Date(e.created_at).toLocaleString()}
                  </div>
                  <ul className="mt-2 space-y-2 text-sm">
                    {(parsed.concepts || []).slice(0, 6).map((c) => (
                      <li key={c.name}>
                        <span className="font-semibold">{c.name}</span>
                        <span className="text-[var(--ink-soft)]"> — {c.definition}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
            {!entries.length && (
              <p className="text-[var(--ink-soft)]">No ontology uploads yet.</p>
            )}
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
