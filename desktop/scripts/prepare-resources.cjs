#!/usr/bin/env node
/**
 * Prepare a production copy of the GraphLoom web app for Electron packaging.
 * Does not modify the web app source — only reads/builds/copies into desktop/resources/.
 */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const https = require("https");
const { createWriteStream } = require("fs");
const { pipeline } = require("stream/promises");

const desktopRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(desktopRoot, "..");
const outRoot = path.join(desktopRoot, "resources", "graphloom-web");
const nodeOut = path.join(desktopRoot, "resources", "node");

function run(cmd, args, cwd) {
  console.log(`> ${cmd} ${args.join(" ")} (cwd=${cwd})`);
  const res = spawnSync(cmd, args, { cwd, stdio: "inherit", shell: process.platform === "win32" });
  if (res.status !== 0) {
    throw new Error(`Command failed (${res.status}): ${cmd} ${args.join(" ")}`);
  }
}

function rimraf(target) {
  fs.rmSync(target, { recursive: true, force: true });
}

function copyPath(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.cpSync(src, dest, { recursive: true, dereference: true });
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const follow = (currentUrl) => {
      https
        .get(currentUrl, (res) => {
          if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            follow(res.headers.location);
            return;
          }
          if (res.statusCode !== 200) {
            reject(new Error(`Download failed ${res.statusCode}: ${currentUrl}`));
            return;
          }
          fs.mkdirSync(path.dirname(dest), { recursive: true });
          const file = createWriteStream(dest);
          pipeline(res, file).then(resolve).catch(reject);
        })
        .on("error", reject);
    };
    follow(url);
  });
}

async function ensureNodeBinary() {
  const platform = process.env.ELECTRON_BUILDER_PLATFORM || process.platform;
  const arch = process.env.ELECTRON_BUILDER_ARCH || process.arch;
  const version = process.env.BUNDLED_NODE_VERSION || "22.14.0";

  let nodeName;
  let url;
  if (platform === "win32" || platform === "windows") {
    nodeName = "node.exe";
    url = `https://nodejs.org/dist/v${version}/win-${arch === "ia32" ? "x86" : "x64"}/node.exe`;
  } else if (platform === "darwin" || platform === "mac") {
    const a = arch === "arm64" ? "arm64" : "x64";
    nodeName = "node";
    // Download tarball and extract would be better; for mac use official binary tarball
    url = `https://nodejs.org/dist/v${version}/node-v${version}-darwin-${a}.tar.gz`;
  } else {
    const a = arch === "arm64" ? "arm64" : "x64";
    nodeName = "node";
    url = `https://nodejs.org/dist/v${version}/node-v${version}-linux-${a}.tar.gz`;
  }

  rimraf(nodeOut);
  fs.mkdirSync(nodeOut, { recursive: true });

  if (url.endsWith(".tar.gz")) {
    const tarPath = path.join(desktopRoot, "resources", "node-dist.tar.gz");
    console.log(`Downloading Node ${version}…`);
    await download(url, tarPath);
    run("tar", ["-xzf", tarPath, "-C", nodeOut, "--strip-components=1"], desktopRoot);
    fs.rmSync(tarPath, { force: true });
    // binary lives at nodeOut/bin/node — flatten for Electron resources/node/node
    const nested = path.join(nodeOut, "bin", "node");
    if (fs.existsSync(nested)) {
      const flat = path.join(desktopRoot, "resources", "_node_bin");
      fs.mkdirSync(flat, { recursive: true });
      fs.copyFileSync(nested, path.join(flat, "node"));
      fs.chmodSync(path.join(flat, "node"), 0o755);
      rimraf(nodeOut);
      fs.renameSync(flat, nodeOut);
    }
  } else {
    console.log(`Downloading Node ${version}…`);
    await download(url, path.join(nodeOut, nodeName));
    if (nodeName === "node") fs.chmodSync(path.join(nodeOut, nodeName), 0o755);
  }

  console.log(`Bundled Node ready at ${nodeOut}`);
}

function main() {
  const skipNode = process.argv.includes("--skip-node");
  const skipBuild = process.argv.includes("--skip-build");

  console.log("Preparing GraphLoom web resources for Electron…");
  console.log(`Repo root: ${repoRoot}`);
  console.log(`Output:    ${outRoot}`);

  if (!skipBuild) {
    if (!fs.existsSync(path.join(repoRoot, "node_modules"))) {
      run("npm", ["ci"], repoRoot);
    }
    run("npm", ["run", "build"], repoRoot);
  }

  rimraf(outRoot);
  fs.mkdirSync(outRoot, { recursive: true });

  const required = [
    "package.json",
    "package-lock.json",
    "next.config.ts",
    "public",
    ".next",
  ];
  for (const rel of required) {
    const src = path.join(repoRoot, rel);
    if (!fs.existsSync(src)) {
      throw new Error(`Missing required path for packaging: ${src}`);
    }
    copyPath(src, path.join(outRoot, rel));
  }

  // Optional but useful for runtime/native module rebuild context
  for (const rel of ["README.md"]) {
    const src = path.join(repoRoot, rel);
    if (fs.existsSync(src)) copyPath(src, path.join(outRoot, rel));
  }

  // Install production deps inside the resource copy (keeps repo root untouched)
  run("npm", ["ci", "--omit=dev"], outRoot);

  // Ensure native module is present for this host when packaging locally
  try {
    run("npm", ["rebuild", "better-sqlite3"], outRoot);
  } catch (e) {
    console.warn("better-sqlite3 rebuild warning:", e.message || e);
  }

  const done = async () => {
    if (!skipNode) await ensureNodeBinary();
    console.log("\nResources prepared.");
    console.log("Next: npm run dist");
  };

  return done();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
