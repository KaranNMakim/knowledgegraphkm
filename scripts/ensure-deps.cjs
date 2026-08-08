#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const nextPkg = path.join(root, "node_modules", "next", "package.json");
const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");

if (!fs.existsSync(nextPkg) || !fs.existsSync(nextBin)) {
  console.error(`
GraphLoom dependencies are missing (next not found in node_modules).

From the repo root, run:

  npm ci
  # or: npm install

Then retry:

  npm run build
`);
  process.exit(1);
}
