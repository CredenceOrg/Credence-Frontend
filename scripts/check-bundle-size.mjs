/**
 * Enforces the production bundle size budget.
 *
 * Reads every JavaScript file in dist/assets, gzips it with zlib.gzipSync and
 * compares it against the per-chunk budgets below. Exits with a non-zero code
 * as soon as any budget is exceeded so a regression cannot be merged silently.
 *
 * Budgets are configured in the constants below. Chunk names are matched
 * without Vite's content hash, so `vendor-react-a1b2c3d4.js` is checked
 * against the `vendor-react` budget.
 *
 * Usage: node scripts/check-bundle-size.mjs [build-dir]
 * Default build-dir: dist
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { gzipSync } from "node:zlib";

const buildDir = resolve(process.argv[2] ?? "dist");
const assetsDir = join(buildDir, "assets");

/**
 * Per-chunk gzipped budgets in kB (1 kB = 1024 bytes).
 *
 * Keep roughly 10% headroom above the measured baseline recorded in
 * docs/BUNDLE.md so incidental changes fit, but adding a heavy dependency does
 * not. Values are zlib gzip sizes, which run ~2-3% larger than Vite's own
 * gzip column.
 */
const BUDGETS_KB = {
  // App bootstrap, layout and router wiring (route pages are lazy chunks).
  // Measured: 44.4 kB.
  index: 50,
  // react, react-dom, react-router-dom, scheduler. Measured: 52.6 kB.
  "vendor-react": 55,
  // i18next, react-i18next, language detector. Measured: 19.7 kB.
  "vendor-i18n": 22,
  // @stellar/freighter-api. Measured: 3.1 kB.
  "vendor-wallet": 12,
  // jsqr — loaded only when the QR dialog scans. Measured: absent from the
  // current bundle (no route imports the dialog), budget kept for when it is.
  "vendor-qr": 15,
  // Anything else from node_modules. Measured: 1.9 kB.
  vendor: 8,
};

/** Total gzipped JS budget across dist/assets, in kB. Measured: 175.8 kB. */
const TOTAL_BUDGET_KB = 200;

/** Fallback budget for any chunk without a specific entry above. */
const DEFAULT_CHUNK_BUDGET_KB = 20;

/** Vite names chunks `<name>-<hash>.js`; the hash is 8 URL-safe characters. */
function baseName(fileName) {
  return fileName.replace(/-[A-Za-z0-9_-]{8}\.js$/, "").replace(/\.js$/, "");
}

function gzipKb(path) {
  return gzipSync(readFileSync(path)).length / 1024;
}

function formatKb(value) {
  return `${value.toFixed(1).padStart(7)} kB`;
}

if (!existsSync(assetsDir)) {
  console.error(`❌ Bundle output not found: ${assetsDir}`);
  console.error("   Run 'npm run build' first, then 'npm run check:bundle'.");
  process.exit(1);
}

const jsFiles = readdirSync(assetsDir)
  .filter((name) => name.endsWith(".js") && !name.endsWith(".js.map"))
  .sort();

if (jsFiles.length === 0) {
  console.error(`❌ No JavaScript files found in ${assetsDir}`);
  console.error("   Run 'npm run build' first, then 'npm run check:bundle'.");
  process.exit(1);
}

const rows = [];
let totalKb = 0;

for (const file of jsFiles) {
  const name = baseName(file);
  const size = gzipKb(join(assetsDir, file));
  const budget = BUDGETS_KB[name] ?? DEFAULT_CHUNK_BUDGET_KB;
  totalKb += size;
  rows.push({ file, name, size, budget, over: size > budget });
}

rows.sort((a, b) => b.size - a.size);

console.log("\nBundle size check (gzip, zlib)\n");
console.log(
  `  ${"chunk".padEnd(38)} ${"size".padStart(10)}  ${"budget".padStart(10)}  status`,
);
console.log(`  ${"-".repeat(38)} ${"-".repeat(10)}  ${"-".repeat(10)}  ------`);

for (const row of rows) {
  const status = row.over ? "FAIL" : "ok";
  console.log(
    `  ${row.file.length > 38 ? `${row.file.slice(0, 35)}...` : row.file.padEnd(38)} ${formatKb(row.size)}  ${formatKb(row.budget)}  ${status}`,
  );
}

const totalOver = totalKb > TOTAL_BUDGET_KB;
console.log(`\n  ${"total JS".padEnd(38)} ${formatKb(totalKb)}  ${formatKb(TOTAL_BUDGET_KB)}  ${totalOver ? "FAIL" : "ok"}\n`);

const violations = rows.filter((row) => row.over);

if (violations.length > 0 || totalOver) {
  console.error("❌ Bundle size budget exceeded:");
  for (const row of violations) {
    console.error(
      `   ${row.name}: ${row.size.toFixed(1)} kB > ${row.budget} kB budget (+${(row.size - row.budget).toFixed(1)} kB)`,
    );
  }
  if (totalOver) {
    console.error(
      `   total JS: ${totalKb.toFixed(1)} kB > ${TOTAL_BUDGET_KB} kB budget (+${(totalKb - TOTAL_BUDGET_KB).toFixed(1)} kB)`,
    );
  }
  console.error(
    "\n   Reduce the chunk (lazy-load it, tree-shake the import, or drop the dependency)\n" +
      "   or raise the budget in scripts/check-bundle-size.mjs and docs/BUNDLE.md with a\n" +
      "   justification in the PR.",
  );
  process.exit(1);
}

console.log("✅ All chunks are within their gzipped budget.");
