import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { assertProjectOwner } from "@/lib/graph";
import {
  connectRemoteAndRegister,
  createConnector,
  ingestCsvFile,
} from "@/lib/connectors";
import type { ConnectorType } from "@/lib/types";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const projectId = new URL(req.url).searchParams.get("projectId");
  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });
  if (!assertProjectOwner(projectId, user.id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const connectors = getDb()
    .prepare(`SELECT * FROM connectors WHERE project_id = ? ORDER BY created_at DESC`)
    .all(projectId);
  return NextResponse.json({ connectors });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const contentType = req.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const projectId = String(form.get("projectId") || "");
    if (!assertProjectOwner(projectId, user.id)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "CSV file required" }, { status: 400 });
    }
    const name = String(form.get("name") || file.name);
    const connectorId =
      String(form.get("connectorId") || "") ||
      createConnector({
        projectId,
        name,
        type: "csv",
        config: {},
      });
    const content = await file.text();
    const result = ingestCsvFile({
      projectId,
      connectorId,
      fileName: file.name,
      content,
      tableName: String(form.get("tableName") || "") || undefined,
    });
    return NextResponse.json({ connectorId, ...result });
  }

  const body = await req.json();
  const projectId = String(body.projectId || "");
  if (!assertProjectOwner(projectId, user.id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const type = String(body.type || "postgres") as ConnectorType;
  const name = String(body.name || `${type} connector`);
  const config = (body.config || {}) as Record<string, unknown>;

  if (type === "csv" && body.csvContent) {
    const connectorId = createConnector({ projectId, name, type: "csv", config });
    const result = ingestCsvFile({
      projectId,
      connectorId,
      fileName: String(body.fileName || "upload.csv"),
      content: String(body.csvContent),
      tableName: body.tableName,
    });
    return NextResponse.json({ connectorId, ...result });
  }

  const result = connectRemoteAndRegister({ projectId, name, type, config });
  return NextResponse.json(result);
}
