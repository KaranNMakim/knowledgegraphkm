import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb, nowIso } from "@/lib/db";
import { assertProjectOwner } from "@/lib/graph";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const project = assertProjectOwner(id, user.id);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const db = getDb();
  const connectors = db
    .prepare(`SELECT * FROM connectors WHERE project_id = ? ORDER BY created_at DESC`)
    .all(id);
  const tables = db
    .prepare(`SELECT * FROM tables_meta WHERE project_id = ? ORDER BY name`)
    .all(id);
  const columns = db
    .prepare(
      `SELECT c.* FROM columns_meta c
       JOIN tables_meta t ON t.id = c.table_id
       WHERE t.project_id = ?`
    )
    .all(id);

  return NextResponse.json({ project, connectors, tables, columns });
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const project = assertProjectOwner(id, user.id);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const db = getDb();
  db.prepare(
    `UPDATE projects SET name = COALESCE(?, name), description = COALESCE(?, description), updated_at = ? WHERE id = ?`
  ).run(body.name ?? null, body.description ?? null, nowIso(), id);

  return NextResponse.json({
    project: db.prepare(`SELECT * FROM projects WHERE id = ?`).get(id),
  });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const project = assertProjectOwner(id, user.id);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  getDb().prepare(`DELETE FROM projects WHERE id = ?`).run(id);
  return NextResponse.json({ ok: true });
}
