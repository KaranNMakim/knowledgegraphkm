import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { assertProjectOwner } from "@/lib/graph";
import { saveOntology } from "@/lib/ontology/dictionary";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const projectId = new URL(req.url).searchParams.get("projectId");
  if (!projectId || !assertProjectOwner(projectId, user.id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const entries = getDb()
    .prepare(
      `SELECT * FROM ontology_entries WHERE project_id = ? ORDER BY created_at DESC`
    )
    .all(projectId);
  return NextResponse.json({ entries });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const projectId = String(body.projectId || "");
  const text = String(body.text || "").trim();
  if (!projectId || !assertProjectOwner(projectId, user.id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!text) return NextResponse.json({ error: "Ontology text required" }, { status: 400 });
  const result = saveOntology(projectId, text);
  return NextResponse.json(result);
}
