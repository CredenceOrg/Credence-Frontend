/**
 * Checks the production build output for accidental console.log calls.
 *
 * Searches all JavaScript bundles in dist/ for console.log references
 * and exits with a non-zero code if any are found.
 *
 * Usage: node scripts/check-console-log.mjs [build-dir]
 * Default build-dir: dist
 */

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const buildDir = resolve(process.argv[2] ?? "dist");

if (!existsSync(buildDir)) {
  console.error(`❌ Build directory not found: ${buildDir}`);
  console.error("   Run 'npm run build' first, then this check.");
  process.exit(1);
}

/**
 * Recursively collect all .js files in a directory.
 */
function collectJSFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectJSFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith(".js")) {
      files.push(fullPath);
    }
  }
  return files;
}

const jsFiles = collectJSFiles(buildDir);
let foundIssues = false;

for (const file of jsFiles) {
  // Skip source maps
  if (file.endsWith(".map")) continue;

  const content = readFileSync(file, "utf-8");

  // Match console.log, console.warn, console.error, console.info, console.debug calls
  // that are NOT part of a comment or string that contains the word "console"
  // We use a simple regex approach: look for `console.<method>(` patterns
  const matches = content.matchAll(
    /(?<![\"'`]\s*)(?<!\/\/\s*)(?<!\*\s*)console\.(log|warn|error|info|debug)\s*\(/g,
  );

  const fileMatches = [];
  for (const match of matches) {
    fileMatches.push(match[0]);
  }

  if (fileMatches.length > 0) {
    console.error(`⚠️  ${file.replace(buildDir, buildDir)}`);
    for (const m of fileMatches) {
      console.error(`   Found: ${m}`);
    }
    foundIssues = true;
  }
}

if (foundIssues) {
  console.error(
    "\n❌ console.log (or console.warn/error/info/debug) calls found in production bundle.",
  );
  console.error("   Remove them before shipping to production.");
  process.exit(1);
} else {
  console.log("✅ No console.log calls found in production bundle.");
}