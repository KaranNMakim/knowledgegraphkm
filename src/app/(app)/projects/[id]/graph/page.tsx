"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import type { GraphEdge, GraphNode } from "@/lib/types";

const KnowledgeGraphView = dynamic(
  () =>
    import("@/components/KnowledgeGraphView").then((m) => m.KnowledgeGraphView),
  { ssr: false }
);

export default function GraphPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const [projectName, setProjectName] = useState("Project");
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [stats, setStats] = useState({
    tables: 0,
    relationships: 0,
    concepts: 0,
    confirmed: 0,
    suggested: 0,
  });

  useEffect(() => {
    Promise.all([
      fetch(`/api/projects/${projectId}`).then((r) => r.json()),
      fetch(`/api/graph?projectId=${projectId}`).then((r) => r.json()),
    ]).then(([proj, graph]) => {
      setProjectName(proj.project?.name || "Project");
      setNodes(graph.nodes || []);
      setEdges(graph.edges || []);
      setStats(graph.stats || stats);
    });
  }, [projectId]);

  return (
    <AppShell projectId={projectId} projectName={projectName}>
      <div className="fade-up">
        <h1 className="brand-mark text-4xl">Knowledge graph</h1>
        <p className="mt-2 max-w-2xl text-[var(--ink-soft)]">
          Tables are nodes; confirmed and suggested joins are edges. Ontology concepts appear as
          darker nodes when uploaded.
        </p>

        <div className="mt-6 flex flex-wrap gap-3 text-sm">
          <span className="chip">{stats.tables} tables</span>
          <span className="chip chip-ok">{stats.confirmed} confirmed</span>
          <span className="chip chip-warn">{stats.suggested} suggested</span>
          <span className="chip">{stats.concepts} concepts</span>
        </div>

        <div className="mt-6">
          <KnowledgeGraphView nodes={nodes} edges={edges} />
        </div>
      </div>
    </AppShell>
  );
}
