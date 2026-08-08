"use client";

import { useEffect, useRef } from "react";
import cytoscape, { Core } from "cytoscape";
import type { GraphEdge, GraphNode } from "@/lib/types";

export function KnowledgeGraphView({
  nodes,
  edges,
}: {
  nodes: GraphNode[];
  edges: GraphEdge[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    if (cyRef.current) {
      cyRef.current.destroy();
      cyRef.current = null;
    }

    const elements = [
      ...nodes.map((n) => ({
        data: {
          id: n.id,
          label: n.label,
          type: n.type,
        },
      })),
      ...edges.map((e) => ({
        data: {
          id: e.id,
          source: e.source,
          target: e.target,
          label: e.label,
          status: e.status || "suggested",
          confidence: e.confidence || 0,
        },
      })),
    ];

    const cy = cytoscape({
      container: ref.current,
      elements,
      style: [
        {
          selector: "node",
          style: {
            label: "data(label)",
            color: "#0b2431",
            "background-color": "#f7f2ea",
            "border-color": "#0f6b62",
            "border-width": 2,
            "font-size": 11,
            "font-family": "Outfit, sans-serif",
            "font-weight": 600,
            "text-valign": "center",
            "text-halign": "center",
            width: 56,
            height: 56,
          },
        },
        {
          selector: 'node[type = "concept"]',
          style: {
            shape: "round-rectangle",
            "background-color": "#0b2431",
            color: "#efe8dc",
            "border-color": "#c4562c",
            width: 70,
            height: 42,
          },
        },
        {
          selector: "edge",
          style: {
            width: 2,
            "line-color": "#7a8f97",
            "target-arrow-color": "#7a8f97",
            "target-arrow-shape": "triangle",
            "curve-style": "bezier",
            label: "data(label)",
            "font-size": 8,
            color: "#1c3d4d",
            "text-rotation": "autorotate",
            "text-margin-y": -8,
          },
        },
        {
          selector: 'edge[status = "confirmed"], edge[status = "manual"]',
          style: {
            "line-color": "#0f6b62",
            "target-arrow-color": "#0f6b62",
            width: 3,
          },
        },
        {
          selector: 'edge[status = "suggested"]',
          style: {
            "line-style": "dashed",
            "line-color": "#c4562c",
            "target-arrow-color": "#c4562c",
          },
        },
      ],
      layout: {
        name: "cose",
        animate: true,
        animationDuration: 700,
        padding: 30,
        nodeRepulsion: () => 6400,
        idealEdgeLength: () => 110,
      },
    });

    cyRef.current = cy;
    return () => {
      cy.destroy();
      cyRef.current = null;
    };
  }, [nodes, edges]);

  return <div ref={ref} className="graph-shell h-[520px] w-full" />;
}
