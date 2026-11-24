/**
 * Checks the production build output for accidental console.log calls.
 *
 * Searches all JavaScript bundles in dist/ for console.log references
 * and exits with a non-zero code if any are found.
 *
 * Usage: node scripts/check-console-log.mjs [build-dir] [--methods=log]
 * Default build-dir: dist
 * Default methods: log
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

const args = process.argv.slice(2)
const dirArg = args.find((a) => !a.startsWith('--'))
const methodsArg = args.find((a) => a.startsWith('--methods='))

const buildDir = resolve(dirArg ?? 'dist')
const methods = methodsArg
  ? methodsArg
      .replace('--methods=', '')
      .split(',')
      .map((m) => m.trim())
  : ['log']

if (!existsSync(buildDir)) {
  console.error(`❌ Build directory not found: ${buildDir}`)
  console.error("   Run 'npm run build' first, then this check.")
  process.exit(1)
}

/**
 * Recursively collect all script files in a directory.
 */
function collectFiles(dir) {
  const files = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue
      files.push(...collectFiles(fullPath))
    } else if (
      entry.isFile() &&
      /\.(js|mjs|ts|tsx)$/.test(entry.name) &&
      !/\.(test|spec)\.[^.]+$/.test(entry.name)
    ) {
      files.push(fullPath)
    }
  }
  return files
}

const targetFiles = collectFiles(buildDir)
let foundIssues = false

const methodPattern = methods.map((m) => m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')
const regex = new RegExp(
  `(?<!["'\`]\\s*)(?<!\\/\\/\\s*)(?<!\\*\\s*)console\\.(${methodPattern})\\s*\\(`,
  'g'
)

for (const file of targetFiles) {
  // Skip source maps
  if (file.endsWith('.map')) continue

  const content = readFileSync(file, 'utf-8')
  const matches = content.matchAll(regex)

  const fileMatches = []
  for (const match of matches) {
    fileMatches.push(match[0])
  }

  if (fileMatches.length > 0) {
    console.error(`⚠️  ${file}`)
    for (const m of fileMatches) {
      console.error(`   Found: ${m}`)
    }
    foundIssues = true
  }
}

if (foundIssues) {
  console.error(`\n❌ console.${methods.join('/')} calls found in production bundle.`)
  console.error('   Remove them before shipping to production.')
  process.exit(1)
} else {
  console.log('✅ No console.log calls found in production bundle.')
}
