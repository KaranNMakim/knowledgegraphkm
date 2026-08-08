const { app, BrowserWindow, shell, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const http = require("http");
const { spawn } = require("child_process");

const DEFAULT_PORT = Number(process.env.GRAPHLOOM_PORT || 4567);
const isDev = !app.isPackaged;

let mainWindow = null;
let nextProcess = null;
let serverPort = DEFAULT_PORT;

function getBundledWebRoot() {
  return path.join(process.resourcesPath, "graphloom-web");
}

function getWebRoot() {
  if (isDev) {
    // desktop/electron → repo root
    return path.resolve(__dirname, "..", "..");
  }

  // Packaged resources are often read-only (e.g. AppImage). Copy once into userData.
  const runtimeRoot = path.join(app.getPath("userData"), "graphloom-web");
  const marker = path.join(runtimeRoot, ".graphloom-runtime");
  const bundled = getBundledWebRoot();

  if (!fs.existsSync(marker)) {
    fs.mkdirSync(app.getPath("userData"), { recursive: true });
    fs.rmSync(runtimeRoot, { recursive: true, force: true });
    fs.cpSync(bundled, runtimeRoot, { recursive: true });
    fs.writeFileSync(
      marker,
      JSON.stringify({ createdAt: new Date().toISOString(), from: bundled }, null, 2)
    );
  }
  return runtimeRoot;
}

function getNodeBinary() {
  if (isDev) {
    return process.env.npm_node_execpath || process.env.NODE_BINARY || "node";
  }
  const bundled = path.join(process.resourcesPath, "node", process.platform === "win32" ? "node.exe" : "node");
  if (fs.existsSync(bundled)) return bundled;
  return process.env.NODE_BINARY || "node";
}

function getNextBin(webRoot) {
  return path.join(webRoot, "node_modules", "next", "dist", "bin", "next");
}

function waitForServer(port, timeoutMs = 90000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      const req = http.get({ host: "127.0.0.1", port, path: "/", timeout: 2000 }, (res) => {
        res.resume();
        resolve(port);
      });
      req.on("error", () => {
        if (Date.now() - started > timeoutMs) {
          reject(new Error(`GraphLoom server did not start on port ${port} within ${timeoutMs}ms`));
          return;
        }
        setTimeout(tryOnce, 400);
      });
      req.on("timeout", () => {
        req.destroy();
      });
    };
    tryOnce();
  });
}

function findFreePort(startPort) {
  return new Promise((resolve, reject) => {
    const server = require("net").createServer();
    server.unref();
    server.on("error", () => {
      // try next
      findFreePort(startPort + 1).then(resolve, reject);
    });
    server.listen(startPort, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

async function startNextServer() {
  const webRoot = getWebRoot();
  const nextBin = getNextBin(webRoot);
  const nodeBin = getNodeBinary();

  if (!fs.existsSync(webRoot)) {
    throw new Error(`Web app root not found: ${webRoot}`);
  }
  if (!fs.existsSync(nextBin)) {
    throw new Error(
      `Next.js binary not found at ${nextBin}. Run "npm install" in the GraphLoom web app root, then "npm run prepare:resources" from desktop/.`
    );
  }

  serverPort = await findFreePort(DEFAULT_PORT);
  const dataDir = isDev
    ? path.join(webRoot, "data")
    : path.join(app.getPath("userData"), "data");
  fs.mkdirSync(dataDir, { recursive: true });

  const env = {
    ...process.env,
    PORT: String(serverPort),
    HOSTNAME: "127.0.0.1",
    NODE_ENV: "production",
    GRAPHLOOM_DATA_DIR: dataDir,
    ELECTRON_RUN: "1",
  };

  // Prefer production start; fall back to next start only.
  const args = [nextBin, "start", "--hostname", "127.0.0.1", "--port", String(serverPort)];

  nextProcess = spawn(nodeBin, args, {
    cwd: webRoot,
    env,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });

  nextProcess.stdout.on("data", (buf) => {
    console.log(`[next] ${buf.toString().trim()}`);
  });
  nextProcess.stderr.on("data", (buf) => {
    console.error(`[next] ${buf.toString().trim()}`);
  });
  nextProcess.on("exit", (code, signal) => {
    console.log(`[next] exited code=${code} signal=${signal}`);
    nextProcess = null;
  });

  await waitForServer(serverPort);
  return serverPort;
}

function createWindow(port) {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: "GraphLoom",
    backgroundColor: "#f7f2ea",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
    show: false,
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.loadURL(`http://127.0.0.1:${port}`);
}

function stopNextServer() {
  if (!nextProcess) return;
  const child = nextProcess;
  nextProcess = null;
  try {
    if (process.platform === "win32") {
      spawn("taskkill", ["/pid", String(child.pid), "/f", "/t"]);
    } else {
      child.kill("SIGTERM");
      setTimeout(() => {
        try {
          child.kill("SIGKILL");
        } catch {
          /* ignore */
        }
      }, 3000).unref?.();
    }
  } catch {
    /* ignore */
  }
}

async function boot() {
  try {
    const port = await startNextServer();
    createWindow(port);
  } catch (err) {
    console.error(err);
    dialog.showErrorBox(
      "GraphLoom failed to start",
      `${err instanceof Error ? err.message : String(err)}\n\nSee desktop/README.md for packaging steps.`
    );
    app.quit();
  }
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(boot);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0 && !nextProcess) {
      boot();
    }
  });

  app.on("window-all-closed", () => {
    stopNextServer();
    if (process.platform !== "darwin") app.quit();
  });

  app.on("before-quit", () => {
    stopNextServer();
  });
}
