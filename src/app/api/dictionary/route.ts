import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { assertProjectOwner } from "@/lib/graph";
import { rebuildDictionary } from "@/lib/ontology/dictionary";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const projectId = new URL(req.url).searchParams.get("projectId");
  if (!projectId || !assertProjectOwner(projectId, user.id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const entries = getDb()
    .prepare(
      `SELECT * FROM dictionary_entries WHERE project_id = ? ORDER BY entity_type, name`
    )
    .all(projectId);
  return NextResponse.json({ entries });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const projectId = String(body.projectId || "");
  if (!projectId || !assertProjectOwner(projectId, user.id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const count = rebuildDictionary(projectId);
  return NextResponse.json({ rebuilt: count.c });
}
