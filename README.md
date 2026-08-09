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
npm install
npm run build
npm run start
```

> If you see `next: not found`, dependencies are not installed. Run `npm install` (or `npm ci`) from the **repo root**, then retry.

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

## Troubleshooting

### `sh: next: not found`
Dependencies are missing or incomplete. From the repository root:

```bash
npm ci
# if that fails: npm install
npm run build
```

Do not run build from `desktop/` unless you are packaging the Electron app.
This app uses a native SQLite module. You need a working Node native build toolchain:

- **Windows**: Visual Studio Build Tools with “Desktop development with C++”
- **macOS**: Xcode CLT (`xcode-select --install`)
- **Linux**: `python3`, `make`, `g++`

Then:

```bash
npm rebuild better-sqlite3
npm run build
```

### Node version
Use **Node 20.9+** (Node 22 recommended).

### Lint on Next.js 16
`next lint` was removed in Next.js 16. Use `npm run lint` (runs ESLint directly).
