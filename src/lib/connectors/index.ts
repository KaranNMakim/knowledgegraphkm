import fs from "fs";
import path from "path";
import { v4 as uuid } from "uuid";
import Papa from "papaparse";
import { getDb, nowIso } from "../db";
import type { ConnectorType } from "../types";
import { inferRelationships } from "../inference/relationships";
import { rebuildDictionary } from "../ontology/dictionary";

const UPLOAD_DIR = path.join(process.cwd(), "data", "uploads");

export function ensureUploadDir() {
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  return UPLOAD_DIR;
}

function inferType(values: string[]): string {
  const nonEmpty = values.filter((v) => v !== "");
  if (!nonEmpty.length) return "text";
  if (nonEmpty.every((v) => /^-?\d+$/.test(v))) return "integer";
  if (nonEmpty.every((v) => /^-?\d+(\.\d+)?$/.test(v))) return "number";
  if (nonEmpty.every((v) => /^\d{4}-\d{2}-\d{2}/.test(v))) return "date";
  return "text";
}

function ingestRows(
  projectId: string,
  connectorId: string,
  tableName: string,
  headers: string[],
  rows: Record<string, string>[],
  description?: string
) {
  const db = getDb();
  const tableId = uuid();
  db.prepare(
    `INSERT INTO tables_meta (id, connector_id, project_id, name, row_count, description)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    tableId,
    connectorId,
    projectId,
    tableName,
    rows.length,
    description || null
  );

  const insertCol = db.prepare(
    `INSERT INTO columns_meta
     (id, table_id, name, data_type, sample_values_json, distinct_count, null_ratio, description, is_pk)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertRow = db.prepare(
    `INSERT INTO table_rows (table_id, row_json) VALUES (?, ?)`
  );

  for (const header of headers) {
    const values = rows.map((r) => String(r[header] ?? ""));
    const nonEmpty = values.filter((v) => v !== "");
    const distinct = [...new Set(nonEmpty)];
    const isPk =
      header.toLowerCase() === "id" ||
      header.toLowerCase() === `${tableName.toLowerCase()}_id` ||
      (header.toLowerCase().endsWith("_id") &&
        distinct.length === nonEmpty.length &&
        nonEmpty.length > 0)
        ? 1
        : 0;
    insertCol.run(
      uuid(),
      tableId,
      header,
      inferType(values),
      JSON.stringify(distinct.slice(0, 25)),
      distinct.length,
      rows.length ? (rows.length - nonEmpty.length) / rows.length : 0,
      null,
      isPk
    );
  }

  const tx = db.transaction((batch: Record<string, string>[]) => {
    for (const row of batch) insertRow.run(tableId, JSON.stringify(row));
  });
  tx(rows);

  return tableId;
}

export function createConnector(input: {
  projectId: string;
  name: string;
  type: ConnectorType;
  config: Record<string, unknown>;
}) {
  const db = getDb();
  const id = uuid();
  db.prepare(
    `INSERT INTO connectors (id, project_id, name, type, config_json, status, last_sync_at, created_at)
     VALUES (?, ?, ?, ?, ?, 'idle', NULL, ?)`
  ).run(
    id,
    input.projectId,
    input.name,
    input.type,
    JSON.stringify(input.config),
    nowIso()
  );
  return id;
}

export function ingestCsvFile(input: {
  projectId: string;
  connectorId: string;
  fileName: string;
  content: string;
  tableName?: string;
}) {
  const parsed = Papa.parse<Record<string, string>>(input.content, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
  if (parsed.errors.length && !parsed.data.length) {
    throw new Error(parsed.errors[0]?.message || "Failed to parse CSV");
  }
  const headers = parsed.meta.fields || Object.keys(parsed.data[0] || {});
  const rows = parsed.data.map((row) => {
    const clean: Record<string, string> = {};
    for (const h of headers) clean[h] = String(row[h] ?? "");
    return clean;
  });
  const tableName =
    input.tableName ||
    input.fileName.replace(/\.csv$/i, "").replace(/[^a-zA-Z0-9_]/g, "_");

  ensureUploadDir();
  const dest = path.join(
    UPLOAD_DIR,
    `${input.projectId}_${tableName}_${Date.now()}.csv`
  );
  fs.writeFileSync(dest, input.content);

  const tableId = ingestRows(
    input.projectId,
    input.connectorId,
    tableName,
    headers,
    rows,
    `Uploaded CSV ${input.fileName}`
  );

  const db = getDb();
  db.prepare(
    `UPDATE connectors SET status = 'connected', last_sync_at = ?, config_json = ?
     WHERE id = ?`
  ).run(
    nowIso(),
    JSON.stringify({ lastFile: input.fileName, path: dest }),
    input.connectorId
  );

  inferRelationships(input.projectId);
  rebuildDictionary(input.projectId);
  return { tableId, tableName, rowCount: rows.length, columns: headers.length };
}

export function testRemoteConnector(type: ConnectorType, config: Record<string, unknown>) {
  // Demo-safe: validate config shape and return simulated connection metadata.
  // Real drivers can be plugged in later without changing the UI contract.
  const requiredByType: Record<ConnectorType, string[]> = {
    csv: [],
    sqlite: ["filepath"],
    postgres: ["host", "port", "database", "username"],
    mysql: ["host", "port", "database", "username"],
    mssql: ["host", "port", "database", "username"],
    mongodb: ["uri", "database"],
  };

  const required = requiredByType[type] || [];
  const missing = required.filter((k) => !config[k]);
  if (missing.length) {
    return {
      ok: false as const,
      message: `Missing fields: ${missing.join(", ")}`,
    };
  }

  return {
    ok: true as const,
    message: `${type} connector configuration looks valid. Live query drivers are stubbed in this demo — use CSV upload or the retail seed for data.`,
    suggestedTables: [
      { name: "sample_entities", columns: ["id", "name", "updated_at"] },
      { name: "sample_events", columns: ["id", "entity_id", "event_ts"] },
    ],
  };
}

export function connectRemoteAndRegister(input: {
  projectId: string;
  name: string;
  type: ConnectorType;
  config: Record<string, unknown>;
}) {
  const test = testRemoteConnector(input.type, input.config);
  const connectorId = createConnector({
    projectId: input.projectId,
    name: input.name,
    type: input.type,
    config: input.config,
  });
  const db = getDb();
  db.prepare(
    `UPDATE connectors SET status = ?, last_sync_at = ? WHERE id = ?`
  ).run(test.ok ? "connected" : "error", nowIso(), connectorId);

  return { connectorId, test };
}
