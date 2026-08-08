#!/usr/bin/env node
/**
 * Prepare a production copy of the GraphLoom web app for Electron packaging.
 * Does not modify the web app source — only reads/builds/copies into desktop/resources/.
 *
 * Usage:
 *   node scripts/prepare-resources.cjs [--skip-build] [--skip-node] [--platform=win32|linux|darwin]
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

function argValue(prefix) {
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : null;
}

function normalizePlatform(raw) {
  const p = (raw || process.env.ELECTRON_BUILDER_PLATFORM || process.platform || "").toLowerCase();
  if (p === "windows" || p === "win" || p === "win32") return "win32";
  if (p === "mac" || p === "macos" || p === "osx" || p === "darwin") return "darwin";
  if (p === "linux") return "linux";
  return process.platform;
}

function run(cmd, args, cwd, env = {}) {
  console.log(`> ${cmd} ${args.join(" ")} (cwd=${cwd})`);
  const res = spawnSync(cmd, args, {
    cwd,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, ...env },
  });
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

async function ensureNodeBinary(platform, arch) {
  const version = process.env.BUNDLED_NODE_VERSION || "22.14.0";
  const a = arch === "ia32" || arch === "x86" ? "x86" : arch === "arm64" ? "arm64" : "x64";

  let nodeName;
  let url;
  if (platform === "win32") {
    nodeName = "node.exe";
    url = `https://nodejs.org/dist/v${version}/win-${a === "x86" ? "x86" : "x64"}/node.exe`;
  } else if (platform === "darwin") {
    nodeName = "node";
    url = `https://nodejs.org/dist/v${version}/node-v${version}-darwin-${a}.tar.gz`;
  } else {
    nodeName = "node";
    url = `https://nodejs.org/dist/v${version}/node-v${version}-linux-${a}.tar.gz`;
  }

  rimraf(nodeOut);
  fs.mkdirSync(nodeOut, { recursive: true });

  if (url.endsWith(".tar.gz")) {
    const tarPath = path.join(desktopRoot, "resources", "node-dist.tar.gz");
    console.log(`Downloading Node ${version} for ${platform}-${a}…`);
    await download(url, tarPath);
    run("tar", ["-xzf", tarPath, "-C", nodeOut, "--strip-components=1"], desktopRoot);
    fs.rmSync(tarPath, { force: true });
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
    console.log(`Downloading Node ${version} for ${platform}-${a}…`);
    await download(url, path.join(nodeOut, nodeName));
    if (nodeName === "node") fs.chmodSync(path.join(nodeOut, nodeName), 0o755);
  }

  console.log(`Bundled Node ready at ${nodeOut}`);
}

function installNativeDeps(targetPlatform, arch) {
  // Fresh production install for the host first (gets JS deps).
  run("npm", ["ci", "--omit=dev"], outRoot);

  // Reinstall better-sqlite3 for the *target* platform using prebuilds when possible.
  const npmEnv = {
    npm_config_platform: targetPlatform,
    npm_config_arch: arch === "ia32" ? "ia32" : arch === "arm64" ? "arm64" : "x64",
    npm_config_target_platform: targetPlatform,
    npm_config_target_arch: arch === "ia32" ? "ia32" : arch === "arm64" ? "arm64" : "x64",
  };

  console.log(`Installing better-sqlite3 prebuild for ${targetPlatform}/${npmEnv.npm_config_arch}…`);
  try {
    run(
      "npm",
      ["rebuild", "better-sqlite3", "--foreground-scripts"],
      outRoot,
      npmEnv
    );
  } catch (e) {
    console.warn("rebuild with target platform failed, trying reinstall…", e.message || e);
    run(
      "npm",
      ["install", "better-sqlite3", "--no-save", "--foreground-scripts"],
      outRoot,
      npmEnv
    );
  }
}

async function main() {
  const skipNode = process.argv.includes("--skip-node");
  const skipBuild = process.argv.includes("--skip-build");
  const targetPlatform = normalizePlatform(argValue("--platform="));
  const arch = (argValue("--arch=") || process.env.ELECTRON_BUILDER_ARCH || "x64").replace(/^x86_64$/, "x64");

  console.log("Preparing GraphLoom web resources for Electron…");
  console.log(`Repo root: ${repoRoot}`);
  console.log(`Output:    ${outRoot}`);
  console.log(`Target:    ${targetPlatform}/${arch}`);

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

  for (const rel of ["README.md"]) {
    const src = path.join(repoRoot, rel);
    if (fs.existsSync(src)) copyPath(src, path.join(outRoot, rel));
  }

  installNativeDeps(targetPlatform, arch);

  if (!skipNode) {
    process.env.ELECTRON_BUILDER_PLATFORM = targetPlatform;
    process.env.ELECTRON_BUILDER_ARCH = arch;
    await ensureNodeBinary(targetPlatform, arch);
  }

  // Persist target marker for debugging packaged builds
  fs.writeFileSync(
    path.join(desktopRoot, "resources", "target.json"),
    JSON.stringify({ platform: targetPlatform, arch, preparedAt: new Date().toISOString() }, null, 2)
  );

  console.log("\nResources prepared.");
  console.log("Next: npm run dist / npm run dist:win / npm run dist:linux");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
