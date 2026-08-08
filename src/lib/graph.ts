import { getDb } from "./db";
import type { GraphEdge, GraphNode, RelationshipStatus } from "./types";

export function buildProjectGraph(projectId: string) {
  const db = getDb();
  const tables = db
    .prepare(`SELECT * FROM tables_meta WHERE project_id = ?`)
    .all(projectId) as {
    id: string;
    name: string;
    row_count: number;
    description: string | null;
  }[];

  const relationships = db
    .prepare(
      `SELECT r.*,
        st.name as source_table, sc.name as source_column,
        tt.name as target_table, tc.name as target_column
       FROM relationships r
       JOIN tables_meta st ON st.id = r.source_table_id
       JOIN columns_meta sc ON sc.id = r.source_column_id
       JOIN tables_meta tt ON tt.id = r.target_table_id
       JOIN columns_meta tc ON tc.id = r.target_column_id
       WHERE r.project_id = ? AND r.status != 'rejected'`
    )
    .all(projectId) as {
    id: string;
    source_table_id: string;
    target_table_id: string;
    source_table: string;
    source_column: string;
    target_table: string;
    target_column: string;
    confidence: number;
    status: RelationshipStatus;
    rationale: string;
  }[];

  const nodes: GraphNode[] = tables.map((t) => ({
    id: t.id,
    label: t.name,
    type: "table",
    meta: {
      row_count: t.row_count,
      description: t.description,
    },
  }));

  const concepts = db
    .prepare(
      `SELECT * FROM dictionary_entries
       WHERE project_id = ? AND entity_type = 'concept' AND source = 'ontology'`
    )
    .all(projectId) as { id: string; name: string; definition: string }[];

  for (const c of concepts) {
    nodes.push({
      id: `concept:${c.id}`,
      label: c.name,
      type: "concept",
      meta: { definition: c.definition },
    });
  }

  const edges: GraphEdge[] = relationships.map((r) => ({
    id: r.id,
    source: r.source_table_id,
    target: r.target_table_id,
    label: `${r.source_column} → ${r.target_column}`,
    confidence: r.confidence,
    status: r.status,
  }));

  return {
    nodes,
    edges,
    stats: {
      tables: tables.length,
      relationships: relationships.length,
      concepts: concepts.length,
      confirmed: relationships.filter((r) =>
        ["confirmed", "manual"].includes(r.status)
      ).length,
      suggested: relationships.filter((r) => r.status === "suggested").length,
    },
  };
}

export function assertProjectOwner(projectId: string, userId: string) {
  const db = getDb();
  const project = db
    .prepare(`SELECT * FROM projects WHERE id = ? AND owner_id = ?`)
    .get(projectId, userId);
  return project as
    | {
        id: string;
        owner_id: string;
        name: string;
        description: string;
        is_demo: number;
        created_at: string;
        updated_at: string;
      }
    | undefined;
}
