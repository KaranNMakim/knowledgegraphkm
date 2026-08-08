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
