# GraphLoom Desktop (Electron)

Standalone Electron wrapper that launches the existing GraphLoom Next.js web app in a native window and builds installers. **This folder does not modify the web app codebase.**

```
desktop/
  electron/          # Electron main + preload
  scripts/           # Copy/build web app into resources/ for packaging
  resources/         # Generated at prepare time (gitignored)
  release/           # Installer output (gitignored)
  assets/            # Icons / builder resources
```

## Prerequisites

From the **repo root** (already required for the web app):

```bash
npm install
npm run build
```

Then in this folder:

```bash
cd desktop
npm install
```

## Run locally (dev desktop window)

Uses the web app at the repo root (production `next start` against an existing `.next` build):

```bash
cd desktop
npm run build --prefix ..   # if .next is missing
npm start
```

GraphLoom opens at `http://127.0.0.1:<port>` inside an Electron window.

## Build installers

Produces platform installers under `desktop/release/`:

```bash
cd desktop
npm run dist
```

Platform-specific:

| Command | Output |
|---------|--------|
| `npm run dist:linux` | `.AppImage`, `.deb` |
| `npm run dist:win` | Windows **NSIS setup `.exe`** + **portable `.exe`** |
| `npm run dist:mac` | `.dmg` (best on macOS) |
| `npm run dist:dir` | Unpacked app dir (smoke test) |

### Windows `.exe` notes
- `npm run dist:win` prepares **Windows** Node + native modules, then builds with electron-builder.
- Cross-building from Linux requires **Wine** (`wine64`).
- On a Windows machine you can run the same command without Wine.
- Outputs typically:
  - `GraphLoom-<version>-win-x64.exe` — NSIS installer
  - `GraphLoom-<version>-win-x64.exe` portable variant (filename includes `portable` depending on builder version)

`prepare:resources` will:

1. Build the web app in the parent folder (`npm run build`) without changing source files
2. Copy `package.json`, lockfile, `next.config.ts`, `public/`, and `.next/` into `resources/graphloom-web/`
3. Run `npm ci --omit=dev` inside that copy
4. Bundle a portable Node.js binary into `resources/node/` for the packaged app

## Notes

- Desktop user data / SQLite defaults to the Electron `userData` path via `GRAPHLOOM_DATA_DIR` (the web app currently uses `./data` unless you later wire that env var).
- Cross-building Windows/macOS installers from Linux may require extra tooling; build on the target OS when possible.
- SSO/browser flows still work inside the Electron window; external links open in the system browser.
