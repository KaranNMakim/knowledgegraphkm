import { v4 as uuid } from "uuid";
import { getDb, nowIso } from "../db";
import type { ColumnMeta, TableMeta } from "../types";

export interface ParsedOntology {
  concepts: { name: string; definition: string }[];
  mappings: { concept: string; table?: string; column?: string; note?: string }[];
}

export function parseOntologyText(text: string): ParsedOntology {
  const concepts: ParsedOntology["concepts"] = [];
  const mappings: ParsedOntology["mappings"] = [];
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  for (const line of lines) {
    // Pattern: Entity: definition
    const colon = line.match(/^([A-Za-z0-9_ ]+)\s*[:\-–]\s*(.+)$/);
    if (colon) {
      const name = colon[1].trim();
      const definition = colon[2].trim();
      concepts.push({ name, definition });

      const tableMatch =
        definition.match(
          /(?:maps?\s+to|corresponds\s+to)\s+(?:table\s+)?`?([a-zA-Z0-9_]+)`?/i
        ) ||
        definition.match(/table\s+`?([a-zA-Z0-9_]+)`?/i);
      const colMatch = definition.match(
        /(?:column|field)\s+`?([a-zA-Z0-9_]+)`?/i
      );
      if (tableMatch || colMatch) {
        mappings.push({
          concept: name,
          table: tableMatch?.[1],
          column: colMatch?.[1],
          note: definition,
        });
      }
      continue;
    }

    // Pattern: product_id links consumers via sales
    const link = line.match(
      /([a-zA-Z0-9_]+)\s+(?:links?|connects?|relates?)\s+(?:to\s+)?([a-zA-Z0-9_]+)/i
    );
    if (link) {
      mappings.push({
        concept: `${link[1]}→${link[2]}`,
        note: line,
      });
      concepts.push({ name: `${link[1]}→${link[2]}`, definition: line });
    }
  }

  if (!concepts.length && text.trim()) {
    concepts.push({
      name: "Business ontology",
      definition: text.trim().slice(0, 2000),
    });
  }

  return { concepts, mappings };
}

export function saveOntology(projectId: string, rawText: string) {
  const db = getDb();
  const parsed = parseOntologyText(rawText);
  const id = uuid();
  db.prepare(
    `INSERT INTO ontology_entries (id, project_id, raw_text, parsed_json, created_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(id, projectId, rawText, JSON.stringify(parsed), nowIso());

  // Apply concept definitions into dictionary
  const upsert = db.prepare(
    `INSERT INTO dictionary_entries
     (id, project_id, entity_type, entity_id, name, definition, source, updated_at)
     VALUES (?, ?, 'concept', NULL, ?, ?, 'ontology', ?)`
  );
  const ts = nowIso();
  for (const c of parsed.concepts) {
    upsert.run(uuid(), projectId, c.name, c.definition, ts);
  }

  // Try to enrich matching tables/columns
  const tables = db
    .prepare(`SELECT * FROM tables_meta WHERE project_id = ?`)
    .all(projectId) as TableMeta[];
  const columns = db
    .prepare(
      `SELECT c.* FROM columns_meta c
       JOIN tables_meta t ON t.id = c.table_id
       WHERE t.project_id = ?`
    )
    .all(projectId) as ColumnMeta[];

  for (const c of parsed.concepts) {
    const key = c.name.toLowerCase().replace(/\s+/g, "_");
    const table = tables.find(
      (t) =>
        t.name.toLowerCase() === key ||
        t.name.toLowerCase().includes(key) ||
        key.includes(t.name.toLowerCase().replace(/_master|_fact/g, ""))
    );
    if (table) {
      db.prepare(`UPDATE tables_meta SET description = ? WHERE id = ?`).run(
        c.definition,
        table.id
      );
      db.prepare(
        `INSERT INTO dictionary_entries
         (id, project_id, entity_type, entity_id, name, definition, source, updated_at)
         VALUES (?, ?, 'table', ?, ?, ?, 'ontology', ?)`
      ).run(uuid(), projectId, table.id, table.name, c.definition, ts);
    }

    const column = columns.find(
      (col) =>
        col.name.toLowerCase() === key ||
        col.name.toLowerCase() === c.name.toLowerCase()
    );
    if (column) {
      db.prepare(`UPDATE columns_meta SET description = ? WHERE id = ?`).run(
        c.definition,
        column.id
      );
      db.prepare(
        `INSERT INTO dictionary_entries
         (id, project_id, entity_type, entity_id, name, definition, source, updated_at)
         VALUES (?, ?, 'column', ?, ?, ?, 'ontology', ?)`
      ).run(uuid(), projectId, column.id, column.name, c.definition, ts);
    }
  }

  return { id, parsed };
}

export function rebuildDictionary(projectId: string) {
  const db = getDb();
  db.prepare(
    `DELETE FROM dictionary_entries WHERE project_id = ? AND source = 'inferred'`
  ).run(projectId);

  const tables = db
    .prepare(`SELECT * FROM tables_meta WHERE project_id = ?`)
    .all(projectId) as TableMeta[];
  const insert = db.prepare(
    `INSERT INTO dictionary_entries
     (id, project_id, entity_type, entity_id, name, definition, source, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'inferred', ?)`
  );
  const ts = nowIso();

  for (const table of tables) {
    const columns = db
      .prepare(`SELECT * FROM columns_meta WHERE table_id = ?`)
      .all(table.id) as ColumnMeta[];
    const colList = columns.map((c) => c.name).join(", ");
    const def =
      table.description ||
      `Table ${table.name} with ${table.row_count} rows and columns: ${colList}.`;
    insert.run(uuid(), projectId, "table", table.id, table.name, def, ts);

    for (const col of columns) {
      const samples = JSON.parse(col.sample_values_json || "[]") as string[];
      const cdef =
        col.description ||
        `Column ${col.name} (${col.data_type}) in ${table.name}. ` +
          `Distinct values: ${col.distinct_count}. ` +
          (samples.length
            ? `Examples: ${samples.slice(0, 5).join(", ")}.`
            : "");
      insert.run(
        uuid(),
        projectId,
        "column",
        col.id,
        `${table.name}.${col.name}`,
        cdef,
        ts
      );
    }
  }

  const rels = db
    .prepare(
      `SELECT r.*,
        st.name as source_table, sc.name as source_column,
        tt.name as target_table, tc.name as target_column
       FROM relationships r
       JOIN tables_meta st ON st.id = r.source_table_id
       JOIN columns_meta sc ON sc.id = r.source_column_id
       JOIN tables_meta tt ON tt.id = r.target_table_id
       JOIN columns_meta tc ON tc.id = r.target_column_id
       WHERE r.project_id = ? AND r.status IN ('confirmed','manual','suggested')`
    )
    .all(projectId) as {
    id: string;
    source_table: string;
    source_column: string;
    target_table: string;
    target_column: string;
    rationale: string;
    status: string;
    confidence: number;
  }[];

  for (const r of rels) {
    insert.run(
      uuid(),
      projectId,
      "relationship",
      r.id,
      `${r.source_table}.${r.source_column} → ${r.target_table}.${r.target_column}`,
      `${r.status} link (${Math.round(r.confidence * 100)}% confidence): ${r.rationale}`,
      ts
    );
  }

  return db
    .prepare(`SELECT COUNT(*) as c FROM dictionary_entries WHERE project_id = ?`)
    .get(projectId) as { c: number };
}
