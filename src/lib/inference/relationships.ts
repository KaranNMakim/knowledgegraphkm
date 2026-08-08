import { v4 as uuid } from "uuid";
import { getDb, nowIso } from "../db";
import type { ColumnMeta, Relationship, TableMeta } from "../types";

interface ColumnProfile {
  column: ColumnMeta;
  table: TableMeta;
  values: Set<string>;
}

function nameAffinity(a: string, b: string): number {
  const na = a.toLowerCase();
  const nb = b.toLowerCase();
  if (na === nb) return 0.35;
  if (na.endsWith("_id") && nb.endsWith("_id")) {
    const sa = na.replace(/_id$/, "");
    const sb = nb.replace(/_id$/, "");
    if (sa === sb) return 0.4;
    if (sa.includes(sb) || sb.includes(sa)) return 0.2;
  }
  if (na.includes(nb) || nb.includes(na)) return 0.15;
  return 0;
}

function profileColumns(projectId: string): ColumnProfile[] {
  const db = getDb();
  const tables = db
    .prepare(`SELECT * FROM tables_meta WHERE project_id = ?`)
    .all(projectId) as TableMeta[];

  const profiles: ColumnProfile[] = [];
  for (const table of tables) {
    const columns = db
      .prepare(`SELECT * FROM columns_meta WHERE table_id = ?`)
      .all(table.id) as ColumnMeta[];
    const rows = db
      .prepare(`SELECT row_json FROM table_rows WHERE table_id = ?`)
      .all(table.id) as { row_json: string }[];

    for (const column of columns) {
      const values = new Set<string>();
      for (const row of rows) {
        const parsed = JSON.parse(row.row_json) as Record<string, string>;
        const v = parsed[column.name];
        if (v !== undefined && v !== null && String(v).trim() !== "") {
          values.add(String(v).trim());
        }
      }
      profiles.push({ column, table, values });
    }
  }
  return profiles;
}

export function inferRelationships(projectId: string, minOverlap = 0.5) {
  const db = getDb();
  const profiles = profileColumns(projectId);
  const suggestions: Omit<Relationship, "id" | "created_at">[] = [];

  for (let i = 0; i < profiles.length; i++) {
    for (let j = i + 1; j < profiles.length; j++) {
      const a = profiles[i];
      const b = profiles[j];
      if (a.table.id === b.table.id) continue;
      if (a.values.size < 2 || b.values.size < 2) continue;

      // Prefer linking id-like / key-like columns
      const aKeyish =
        a.column.is_pk ||
        a.column.name.toLowerCase().endsWith("_id") ||
        a.column.distinct_count >= a.values.size * 0.7;
      const bKeyish =
        b.column.is_pk ||
        b.column.name.toLowerCase().endsWith("_id") ||
        b.column.distinct_count >= b.values.size * 0.7;
      if (!aKeyish && !bKeyish) continue;

      const smaller = a.values.size <= b.values.size ? a : b;
      const larger = smaller === a ? b : a;
      let shared = 0;
      for (const v of smaller.values) {
        if (larger.values.has(v)) shared++;
      }
      if (shared < 2) continue;

      const overlap = shared / smaller.values.size;
      if (overlap < minOverlap) continue;

      const affinity = nameAffinity(a.column.name, b.column.name);
      const confidence = Math.min(0.99, overlap * 0.75 + affinity);

      // Orient: PK / master side as target when possible
      let source = a;
      let target = b;
      if (b.column.is_pk && !a.column.is_pk) {
        source = a;
        target = b;
      } else if (a.column.is_pk && !b.column.is_pk) {
        source = b;
        target = a;
      } else if (
        b.table.name.includes("master") &&
        !a.table.name.includes("master")
      ) {
        source = a;
        target = b;
      }

      const rationale = `${shared} of ${smaller.values.size} distinct values in ${smaller.table.name}.${smaller.column.name} also appear in ${larger.table.name}.${larger.column.name} (${Math.round(overlap * 100)}% overlap).`;

      suggestions.push({
        project_id: projectId,
        source_table_id: source.table.id,
        source_column_id: source.column.id,
        target_table_id: target.table.id,
        target_column_id: target.column.id,
        confidence,
        overlap_ratio: overlap,
        shared_values: shared,
        status: "suggested",
        rationale,
      });
    }
  }

  // Keep existing confirmed/rejected/manual; refresh suggestions
  db.prepare(
    `DELETE FROM relationships WHERE project_id = ? AND status = 'suggested'`
  ).run(projectId);

  const existing = db
    .prepare(
      `SELECT source_column_id, target_column_id, status FROM relationships WHERE project_id = ?`
    )
    .all(projectId) as {
    source_column_id: string;
    target_column_id: string;
    status: string;
  }[];

  const blocked = new Set(
    existing.map((e) => `${e.source_column_id}->${e.target_column_id}`)
  );
  const insert = db.prepare(
    `INSERT INTO relationships
     (id, project_id, source_table_id, source_column_id, target_table_id, target_column_id,
      confidence, overlap_ratio, shared_values, status, rationale, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'suggested', ?, ?)`
  );

  const ts = nowIso();
  let created = 0;
  for (const s of suggestions.sort((x, y) => y.confidence - x.confidence)) {
    const key = `${s.source_column_id}->${s.target_column_id}`;
    const reverse = `${s.target_column_id}->${s.source_column_id}`;
    if (blocked.has(key) || blocked.has(reverse)) continue;
    insert.run(
      uuid(),
      s.project_id,
      s.source_table_id,
      s.source_column_id,
      s.target_table_id,
      s.target_column_id,
      s.confidence,
      s.overlap_ratio,
      s.shared_values,
      s.rationale,
      ts
    );
    blocked.add(key);
    created++;
  }

  return created;
}

export function createManualRelationship(input: {
  projectId: string;
  sourceTableId: string;
  sourceColumnId: string;
  targetTableId: string;
  targetColumnId: string;
  rationale?: string;
}) {
  const db = getDb();
  const id = uuid();
  db.prepare(
    `INSERT INTO relationships
     (id, project_id, source_table_id, source_column_id, target_table_id, target_column_id,
      confidence, overlap_ratio, shared_values, status, rationale, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 1, 1, 0, 'manual', ?, ?)`
  ).run(
    id,
    input.projectId,
    input.sourceTableId,
    input.sourceColumnId,
    input.targetTableId,
    input.targetColumnId,
    input.rationale || "Manually established connection",
    nowIso()
  );
  return id;
}

export function parseSqlRelationships(sql: string, projectId: string) {
  // Parse simple JOIN ... ON a.col = b.col patterns and FOREIGN KEY hints
  const db = getDb();
  const tables = db
    .prepare(`SELECT * FROM tables_meta WHERE project_id = ?`)
    .all(projectId) as TableMeta[];
  const columns = db
    .prepare(
      `SELECT c.*, t.name as table_name FROM columns_meta c
       JOIN tables_meta t ON t.id = c.table_id
       WHERE t.project_id = ?`
    )
    .all(projectId) as (ColumnMeta & { table_name: string })[];

  const find = (tableHint: string, colHint: string) => {
    const t = tables.find(
      (x) =>
        x.name.toLowerCase() === tableHint.toLowerCase() ||
        x.name.toLowerCase().includes(tableHint.toLowerCase())
    );
    if (!t) return null;
    const c = columns.find(
      (x) =>
        x.table_id === t.id &&
        x.name.toLowerCase() === colHint.toLowerCase()
    );
    if (!c) return null;
    return { table: t, column: c };
  };

  const created: string[] = [];
  const joinRe =
    /join\s+([a-zA-Z0-9_]+)\s+(?:as\s+)?([a-zA-Z0-9_]+)?\s+on\s+([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)\s*=\s*([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = joinRe.exec(sql)) !== null) {
    const leftTable = m[3];
    const leftCol = m[4];
    const rightTable = m[5];
    const rightCol = m[6];
    const left = find(leftTable, leftCol);
    const right = find(rightTable, rightCol);
    if (left && right) {
      const id = createManualRelationship({
        projectId,
        sourceTableId: left.table.id,
        sourceColumnId: left.column.id,
        targetTableId: right.table.id,
        targetColumnId: right.column.id,
        rationale: `Parsed from uploaded SQL JOIN: ${leftTable}.${leftCol} = ${rightTable}.${rightCol}`,
      });
      created.push(id);
    }
  }

  const fkRe =
    /foreign\s+key\s*\(\s*([a-zA-Z0-9_]+)\s*\)\s*references\s+([a-zA-Z0-9_]+)\s*\(\s*([a-zA-Z0-9_]+)\s*\)/gi;
  while ((m = fkRe.exec(sql)) !== null) {
    // Need surrounding table context — best-effort using column names alone
    const localCol = m[1];
    const refTable = m[2];
    const refCol = m[3];
    const sources = columns.filter(
      (c) => c.name.toLowerCase() === localCol.toLowerCase()
    );
    const target = find(refTable, refCol);
    if (target && sources.length) {
      for (const sourceCol of sources) {
        if (sourceCol.table_id === target.table.id) continue;
        const id = createManualRelationship({
          projectId,
          sourceTableId: sourceCol.table_id,
          sourceColumnId: sourceCol.id,
          targetTableId: target.table.id,
          targetColumnId: target.column.id,
          rationale: `Parsed from FOREIGN KEY (${localCol}) REFERENCES ${refTable}(${refCol})`,
        });
        created.push(id);
      }
    }
  }

  return created;
}
