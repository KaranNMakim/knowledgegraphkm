import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb, nowIso } from "@/lib/db";
import { assertProjectOwner } from "@/lib/graph";
import {
  createManualRelationship,
  inferRelationships,
  parseSqlRelationships,
} from "@/lib/inference/relationships";
import { rebuildDictionary } from "@/lib/ontology/dictionary";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const projectId = new URL(req.url).searchParams.get("projectId");
  if (!projectId || !assertProjectOwner(projectId, user.id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const relationships = getDb()
    .prepare(
      `SELECT r.*,
        st.name as source_table, sc.name as source_column,
        tt.name as target_table, tc.name as target_column
       FROM relationships r
       JOIN tables_meta st ON st.id = r.source_table_id
       JOIN columns_meta sc ON sc.id = r.source_column_id
       JOIN tables_meta tt ON tt.id = r.target_table_id
       JOIN columns_meta tc ON tc.id = r.target_column_id
       WHERE r.project_id = ?
       ORDER BY
         CASE r.status WHEN 'suggested' THEN 0 WHEN 'confirmed' THEN 1 WHEN 'manual' THEN 1 ELSE 2 END,
         r.confidence DESC`
    )
    .all(projectId);

  return NextResponse.json({ relationships });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const projectId = String(body.projectId || "");
  if (!assertProjectOwner(projectId, user.id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (body.action === "infer") {
    const created = inferRelationships(projectId, Number(body.minOverlap || 0.5));
    rebuildDictionary(projectId);
    getDb()
      .prepare(`UPDATE projects SET updated_at = ? WHERE id = ?`)
      .run(nowIso(), projectId);
    return NextResponse.json({ created });
  }

  if (body.action === "sql") {
    const ids = parseSqlRelationships(String(body.sql || ""), projectId);
    rebuildDictionary(projectId);
    return NextResponse.json({ created: ids.length, ids });
  }

  if (body.action === "manual") {
    const id = createManualRelationship({
      projectId,
      sourceTableId: body.sourceTableId,
      sourceColumnId: body.sourceColumnId,
      targetTableId: body.targetTableId,
      targetColumnId: body.targetColumnId,
      rationale: body.rationale,
    });
    rebuildDictionary(projectId);
    return NextResponse.json({ id });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const id = String(body.id || "");
  const status = String(body.status || "");
  if (!["confirmed", "rejected", "suggested"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const db = getDb();
  const rel = db.prepare(`SELECT * FROM relationships WHERE id = ?`).get(id) as
    | { project_id: string }
    | undefined;
  if (!rel || !assertProjectOwner(rel.project_id, user.id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  db.prepare(`UPDATE relationships SET status = ? WHERE id = ?`).run(status, id);
  rebuildDictionary(rel.project_id);
  return NextResponse.json({ ok: true });
}
