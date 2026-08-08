import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { assertProjectOwner, buildProjectGraph } from "@/lib/graph";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const projectId = new URL(req.url).searchParams.get("projectId");
  if (!projectId || !assertProjectOwner(projectId, user.id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(buildProjectGraph(projectId));
}
