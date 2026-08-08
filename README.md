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

Production:

```bash
npm run build
npm run start
```

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run start` | Run production server |
| `npm run lint` | ESLint |

## Data

App state lives in `data/graphloom.sqlite`. Bundled retail CSVs are written under `data/retail/` on first demo seed. Uploaded CSVs land in `data/uploads/`.

## Cloud agent environment

`.cursor/environment.json` installs npm dependencies / builds the app, then starts GraphLoom on port **3000**.

## Notes

Remote DB connectors validate configuration and register in the project; live JDBC/ODBC drivers are intentionally stubbed for this demo. Use CSV uploads or the retail seed for end-to-end graph building. Wire real drivers behind the same `/api/connectors` contract for production.

Desktop Electron packaging (when present) lives under `desktop/` and does not change the web app source.
