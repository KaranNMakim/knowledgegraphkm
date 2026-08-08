# KnowledgeGraphKM

Helps organizations build knowledge graphs from their internal database.

## Stack

- Python 3.12 + FastAPI
- SQLite internal organizational database
- NetworkX-backed graph builder exposed via REST API and a small web UI

## Local development

```bash
./scripts/cloud-agent-install.sh
source .venv/bin/activate
python -m kgkm.cli --port 8000
```

Open http://localhost:8000 and click **Sync graph from internal DB** to build the knowledge graph from seeded internal data.

## Commands

| Task | Command |
| --- | --- |
| Install dependencies | `./scripts/cloud-agent-install.sh` |
| Run API + UI | `source .venv/bin/activate && python -m kgkm.cli --port 8000` |
| Run tests | `source .venv/bin/activate && pytest` |
| Lint | `source .venv/bin/activate && ruff check .` |

## API

- `GET /health` — service health
- `GET /api/employees` — internal employee records
- `GET /api/projects` — internal project records
- `POST /api/graph/sync` — build knowledge graph from the internal database
- `GET /api/graph` — current knowledge graph snapshot
# GraphLoom

Web app for building **knowledge graphs** from organizational databases.

## Features

- **Auth**: personal accounts and demo SSO (Google Workspace / Microsoft Entra style)
- **Multi-project** workspaces
- **Connectors**: CSV upload (fully working), plus Postgres / MySQL / MSSQL / MongoDB / SQLite connector registration UI
- **Relationship inference**: suggests joins when column values overlap (e.g. 50%+ of `xid` values appear in `yid`)
- **SQL upload** and **manual connection** tabs to establish relationships
- **Plain-English ontology** upload that maps into the data dictionary
- **Auto-built data dictionary** from tables, columns, relationships, and ontology
- **Retail demo project** seeded with product / consumer / date / promotion / store / sales / inventory masters

## Quick start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), register an account, and explore the preloaded **Retail Store Demo** project.

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run start` | Run production server |
| `npm run lint` | ESLint |

## Data

App state lives in `data/graphloom.sqlite`. Bundled retail CSVs are written under `data/retail/` on first demo seed. Uploaded CSVs land in `data/uploads/`.

## Notes

Remote DB connectors validate configuration and register in the project; live JDBC/ODBC drivers are intentionally stubbed for this demo. Use CSV uploads or the retail seed for end-to-end graph building. Wire real drivers behind the same `/api/connectors` contract for production.
