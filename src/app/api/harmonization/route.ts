import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { assertProjectOwner } from "@/lib/graph";
import {
  harmonizeProject,
  harmonizeTable,
} from "@/lib/harmonization/profile";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const projectId = url.searchParams.get("projectId");
  const tableId = url.searchParams.get("tableId");

  if (!projectId || !assertProjectOwner(projectId, user.id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (tableId) {
    const owned = getDb()
      .prepare(`SELECT id FROM tables_meta WHERE id = ? AND project_id = ?`)
      .get(tableId, projectId);
    if (!owned) return NextResponse.json({ error: "Table not found" }, { status: 404 });

    const table = harmonizeTable(tableId);
    if (!table) return NextResponse.json({ error: "Table not found" }, { status: 404 });
    return NextResponse.json({ suite: "data_harmonization", table });
  }

  const summary = harmonizeProject(projectId);
  return NextResponse.json({ suite: "data_harmonization", summary });
}
