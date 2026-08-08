import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb, nowIso } from "@/lib/db";
import { createProject, ensureDemoProject } from "@/lib/seed";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  ensureDemoProject(user.id);
  const db = getDb();
  const projects = db
    .prepare(
      `SELECT p.*,
        (SELECT COUNT(*) FROM connectors c WHERE c.project_id = p.id) as connector_count,
        (SELECT COUNT(*) FROM tables_meta t WHERE t.project_id = p.id) as table_count,
        (SELECT COUNT(*) FROM relationships r WHERE r.project_id = p.id AND r.status != 'rejected') as relationship_count
       FROM projects p
       WHERE p.owner_id = ?
       ORDER BY p.updated_at DESC`
    )
    .all(user.id);

  return NextResponse.json({ projects });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const name = String(body.name || "").trim();
  const description = String(body.description || "").trim();
  const withDemo = Boolean(body.withDemo);

  if (!name && !withDemo) {
    return NextResponse.json({ error: "Project name required" }, { status: 400 });
  }

  const id = createProject(
    user.id,
    name || "Retail Store Demo",
    description || "",
    withDemo
  );
  const db = getDb();
  db.prepare(`UPDATE projects SET updated_at = ? WHERE id = ?`).run(nowIso(), id);
  const project = db.prepare(`SELECT * FROM projects WHERE id = ?`).get(id);
  return NextResponse.json({ project });
}
