import fs from "fs";
import path from "path";
import { v4 as uuid } from "uuid";
import { getDb, nowIso } from "./db";
import { inferRelationships } from "./inference/relationships";
import { rebuildDictionary } from "./ontology/dictionary";

const RETAIL_DIR = path.join(process.cwd(), "data", "retail");

function ensureRetailCsvs() {
  if (!fs.existsSync(RETAIL_DIR)) fs.mkdirSync(RETAIL_DIR, { recursive: true });

  const products = [
    ["product_id", "sku", "product_name", "category", "brand", "unit_price", "unit_cost"],
    ["P001", "SKU-COFFEE-12", "House Blend Coffee 12oz", "Grocery", "RoastCo", "8.99", "3.20"],
    ["P002", "SKU-TEA-EARL", "Earl Grey Tea 20ct", "Grocery", "Leaf&Co", "4.49", "1.50"],
    ["P003", "SKU-MILK-1G", "Organic Whole Milk 1gal", "Dairy", "FarmFresh", "5.29", "2.80"],
    ["P004", "SKU-BREAD-WW", "Whole Wheat Bread", "Bakery", "Ovenly", "3.79", "1.10"],
    ["P005", "SKU-CHIPS-CL", "Classic Potato Chips", "Snacks", "CrunchTime", "2.99", "0.90"],
    ["P006", "SKU-SOAP-LAV", "Lavender Hand Soap", "Personal Care", "CleanAura", "6.49", "2.10"],
    ["P007", "SKU-YOG-GRK", "Greek Yogurt Plain", "Dairy", "FarmFresh", "1.89", "0.70"],
    ["P008", "SKU-OJ-64", "Orange Juice 64oz", "Grocery", "CitrusPeak", "4.99", "2.00"],
    ["P009", "SKU-PAPER-T", "Paper Towels 6pk", "Household", "SoftRoll", "9.99", "4.50"],
    ["P010", "SKU-PASTA-SP", "Spaghetti 16oz", "Grocery", "Nonna", "1.59", "0.45"],
    ["P011", "SKU-SAUCE-MR", "Marinara Sauce", "Grocery", "Nonna", "2.79", "0.95"],
    ["P012", "SKU-CHEESE-CD", "Cheddar Block 8oz", "Dairy", "FarmFresh", "3.99", "1.80"],
    ["P013", "SKU-CEREAL-O", "Oat Crunch Cereal", "Grocery", "MorningBite", "4.29", "1.60"],
    ["P014", "SKU-WATER-24", "Sparkling Water 24pk", "Beverages", "AquaFizz", "7.49", "3.00"],
    ["P015", "SKU-DETERG", "Laundry Detergent", "Household", "CleanAura", "11.99", "5.20"],
  ];

  const consumers = [
    ["consumer_id", "full_name", "email", "segment", "city", "loyalty_tier"],
    ["C001", "Ava Chen", "ava.chen@example.com", "Family", "Austin", "Gold"],
    ["C002", "Marcus Lee", "marcus.lee@example.com", "Young Professional", "Dallas", "Silver"],
    ["C003", "Priya Patel", "priya.patel@example.com", "Family", "Houston", "Gold"],
    ["C004", "Noah Brooks", "noah.brooks@example.com", "Student", "Austin", "Bronze"],
    ["C005", "Elena Rossi", "elena.rossi@example.com", "Empty Nester", "San Antonio", "Platinum"],
    ["C006", "Jamal Wright", "jamal.wright@example.com", "Young Professional", "Dallas", "Silver"],
    ["C007", "Sofia Nguyen", "sofia.nguyen@example.com", "Family", "Houston", "Gold"],
    ["C008", "Liam OConnor", "liam.oconnor@example.com", "Student", "Austin", "Bronze"],
    ["C009", "Hannah Kim", "hannah.kim@example.com", "Young Professional", "Dallas", "Silver"],
    ["C010", "Diego Morales", "diego.morales@example.com", "Family", "San Antonio", "Gold"],
    ["C011", "Grace Miller", "grace.miller@example.com", "Empty Nester", "Austin", "Platinum"],
    ["C012", "Omar Hassan", "omar.hassan@example.com", "Young Professional", "Houston", "Silver"],
  ];

  const dates: string[][] = [
    ["date_id", "full_date", "year", "quarter", "month", "month_name", "week", "day_name", "is_weekend"],
  ];
  const start = new Date("2024-01-01");
  for (let i = 0; i < 90; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const id = `D${String(i + 1).padStart(3, "0")}`;
    const q = Math.floor(d.getMonth() / 3) + 1;
    const week = Math.ceil((i + 1) / 7);
    const day = d.toLocaleDateString("en-US", { weekday: "long" });
    const monthName = d.toLocaleDateString("en-US", { month: "long" });
    const isWeekend = day === "Saturday" || day === "Sunday" ? "1" : "0";
    dates.push([
      id,
      d.toISOString().slice(0, 10),
      String(d.getFullYear()),
      `Q${q}`,
      String(d.getMonth() + 1),
      monthName,
      String(week),
      day,
      isWeekend,
    ]);
  }

  const promotions = [
    ["promo_id", "promo_name", "discount_pct", "start_date_id", "end_date_id", "channel", "promo_type"],
    ["PR01", "New Year Essentials", "15", "D001", "D014", "In-Store", "Percent Off"],
    ["PR02", "Dairy Days", "10", "D010", "D024", "App", "Percent Off"],
    ["PR03", "Snack Attack", "20", "D020", "D034", "In-Store", "BOGO"],
    ["PR04", "Clean Home Week", "12", "D030", "D044", "Email", "Percent Off"],
    ["PR05", "Breakfast Boost", "15", "D040", "D054", "App", "Percent Off"],
    ["PR06", "Spring Refresh", "18", "D055", "D075", "In-Store", "Bundle"],
    ["PR07", "Loyalty Flash", "25", "D070", "D084", "App", "Percent Off"],
  ];

  const stores = [
    ["store_id", "store_name", "region", "city", "store_format"],
    ["S01", "GraphLoom Market Downtown", "Central", "Austin", "Urban"],
    ["S02", "GraphLoom Market North", "North", "Dallas", "Suburban"],
    ["S03", "GraphLoom Market Bayou", "South", "Houston", "Urban"],
    ["S04", "GraphLoom Market Riverwalk", "South", "San Antonio", "Tourist"],
    ["S05", "GraphLoom Express Campus", "Central", "Austin", "Express"],
  ];

  const productIds = products.slice(1).map((r) => r[0]);
  const consumerIds = consumers.slice(1).map((r) => r[0]);
  const dateIds = dates.slice(1).map((r) => r[0]);
  const promoIds = promotions.slice(1).map((r) => r[0]);
  const storeIds = stores.slice(1).map((r) => r[0]);

  const sales: string[][] = [
    [
      "sale_id",
      "product_id",
      "consumer_id",
      "date_id",
      "store_id",
      "promo_id",
      "quantity",
      "net_amount",
    ],
  ];
  for (let i = 1; i <= 120; i++) {
    const product = productIds[i % productIds.length];
    const consumer = consumerIds[i % consumerIds.length];
    const date = dateIds[i % dateIds.length];
    const store = storeIds[i % storeIds.length];
    const promo = i % 4 === 0 ? promoIds[i % promoIds.length] : "";
    const qty = (i % 5) + 1;
    const price = Number(products.slice(1).find((p) => p[0] === product)?.[5] || 5);
    sales.push([
      `SL${String(i).padStart(3, "0")}`,
      product,
      consumer,
      date,
      store,
      promo,
      String(qty),
      (qty * price).toFixed(2),
    ]);
  }

  const inventory: string[][] = [
    ["inventory_id", "product_id", "store_id", "date_id", "on_hand", "reorder_point"],
  ];
  let inv = 1;
  for (const store of storeIds) {
    for (const product of productIds) {
      const date = dateIds[(inv * 3) % dateIds.length];
      inventory.push([
        `INV${String(inv).padStart(3, "0")}`,
        product,
        store,
        date,
        String(20 + (inv % 40)),
        "15",
      ]);
      inv++;
    }
  }

  const files: Record<string, string[][]> = {
    product_master: products,
    consumer_master: consumers,
    date_master: dates,
    promotion_master: promotions,
    store_master: stores,
    sales_fact: sales,
    inventory_fact: inventory,
  };

  for (const [name, rows] of Object.entries(files)) {
    const csv = rows
      .map((r) =>
        r
          .map((cell) => {
            if (cell.includes(",") || cell.includes('"')) {
              return `"${cell.replace(/"/g, '""')}"`;
            }
            return cell;
          })
          .join(",")
      )
      .join("\n");
    fs.writeFileSync(path.join(RETAIL_DIR, `${name}.csv`), csv);
  }

  return Object.keys(files);
}

function loadCsvTable(
  projectId: string,
  connectorId: string,
  tableName: string,
  filePath: string
) {
  const db = getDb();
  const text = fs.readFileSync(filePath, "utf8");
  const lines = text.trim().split(/\r?\n/);
  const headers = lines[0].split(",").map((h) => h.replace(/^"|"$/g, ""));
  const rows = lines.slice(1).map((line) => {
    const cells: string[] = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQ && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQ = !inQ;
      } else if (ch === "," && !inQ) {
        cells.push(cur);
        cur = "";
      } else cur += ch;
    }
    cells.push(cur);
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      obj[h] = cells[idx] ?? "";
    });
    return obj;
  });

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
    `Retail demo table ${tableName}`
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
    const values = rows.map((r) => r[header] ?? "");
    const nonEmpty = values.filter((v) => v !== "");
    const distinct = new Set(nonEmpty);
    const sample = [...distinct].slice(0, 25);
    const isPk =
      header.endsWith("_id") &&
      (header === `${tableName.replace(/_master|_fact/g, "")}_id` ||
        header === tableName.replace("_master", "_id").replace("_fact", "_id") ||
        ["product_id", "consumer_id", "date_id", "promo_id", "store_id", "sale_id", "inventory_id"].includes(
          header
        )) &&
      tableName.includes(header.replace("_id", ""))
        ? 1
        : header === `${tableName.split("_")[0]}_id` ||
            (tableName === "product_master" && header === "product_id") ||
            (tableName === "consumer_master" && header === "consumer_id") ||
            (tableName === "date_master" && header === "date_id") ||
            (tableName === "promotion_master" && header === "promo_id") ||
            (tableName === "store_master" && header === "store_id") ||
            (tableName === "sales_fact" && header === "sale_id") ||
            (tableName === "inventory_fact" && header === "inventory_id")
          ? 1
          : 0;

    const numeric = nonEmpty.every((v) => v === "" || !Number.isNaN(Number(v)));
    insertCol.run(
      uuid(),
      tableId,
      header,
      numeric ? "number" : "text",
      JSON.stringify(sample),
      distinct.size,
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

export function ensureDemoProject(ownerId: string) {
  const db = getDb();
  const existing = db
    .prepare(
      `SELECT * FROM projects WHERE owner_id = ? AND is_demo = 1 LIMIT 1`
    )
    .get(ownerId) as { id: string } | undefined;
  if (existing) return existing.id;

  const tables = ensureRetailCsvs();
  const projectId = uuid();
  const ts = nowIso();
  db.prepare(
    `INSERT INTO projects (id, owner_id, name, description, is_demo, created_at, updated_at)
     VALUES (?, ?, ?, ?, 1, ?, ?)`
  ).run(
    projectId,
    ownerId,
    "Retail Store Demo",
    "Sample retail knowledge graph with product, consumer, date, promotion, store, sales, and inventory masters.",
    ts,
    ts
  );

  const connectorId = uuid();
  db.prepare(
    `INSERT INTO connectors (id, project_id, name, type, config_json, status, last_sync_at, created_at)
     VALUES (?, ?, ?, 'csv', ?, 'connected', ?, ?)`
  ).run(
    connectorId,
    projectId,
    "Retail CSV Warehouse",
    JSON.stringify({ source: "bundled-retail", path: "data/retail" }),
    ts,
    ts
  );

  for (const table of tables) {
    loadCsvTable(
      projectId,
      connectorId,
      table,
      path.join(RETAIL_DIR, `${table}.csv`)
    );
  }

  inferRelationships(projectId);
  rebuildDictionary(projectId);
  return projectId;
}

export function createProject(
  ownerId: string,
  name: string,
  description: string,
  withDemoSeed = false
) {
  if (withDemoSeed) return ensureDemoProject(ownerId);

  const db = getDb();
  const id = uuid();
  const ts = nowIso();
  db.prepare(
    `INSERT INTO projects (id, owner_id, name, description, is_demo, created_at, updated_at)
     VALUES (?, ?, ?, ?, 0, ?, ?)`
  ).run(id, ownerId, name, description, ts, ts);
  return id;
}
