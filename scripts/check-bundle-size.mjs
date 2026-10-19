#!/usr/bin/env node
/**
 * Bundle size budget checker.
 *
 * Reads `dist/.vite/manifest.json` (emitted by `build.manifest: true`),
 * gzips each chunk with `zlib`, and fails the build when a budget is exceeded.
 *
 * Budgets:
 *   - app entry chunk (excluding vendor-*)     <= 40 kB gzip
 *   - first paint of / (entry + vendors + Home) <= 105 kB gzip
 *   - any route chunk                       <= 25 kB gzip
 */
import { readFileSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { gzipSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'

const DEFAULT_DIST = resolve(process.cwd(), 'dist')

const BUDGETS = {
  entryMaxGzipKB: 40,
  firstPaintMaxGzipKB: 105,
  routeMaxGzipKB: 25,
}

function gzipSize(filePath) {
  return gzipSync(readFileSync(filePath)).length
}

function isVendor(name) {
  return /^(vendor-|vendors-|v\/)/.test(name)
}

function isEntry(key, chunk) {
  return chunk.isEntry === true || /index-/.test(key)
}

function isRouteChunk(key, chunk) {
  if (isVendor(key) || isEntry(key, chunk)) return false
  // Route chunks are dynamic imports that contain a page component.
  return /\/(?:pages|Pages|routes|Routes)\//.test(key) || /Page|Page\./.test(key)
}

function findHomeChunk(manifest) {
  for (const [key] of Object.keys(manifest)) {
    if (/Home\|HomePage\.|\/Home\./.test(key)) {
      return key
    }
  }
  return null
}

function formatKB(bytes) {
  return (bytes / 1024).toFixed(2)
}

export function checkBundleSize(options = {}) {
  const distDir = options.distDir ? resolve(options.distDir) : DEFAULT_DIST
  const manifestPath = join(distDir, '.vite', 'manifest.json')
  const log = options.log || console.log

  if (!existsSync(manifestPath)) {
    const msg = `Bundle manifest not found at ${manifestPath}. Run \`npm run build\` first.`
    if (options.throwOnError === false) return { ok: false, message: msg, rows: [] }
    throw new Error(msg)
  }

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  const rows = []
  const failures = []

  let entryGzip = 0
  let entryKey = null
  let vendorGazip = 0
  const vendorKeys = []
  const routeKeys = []

  for (const [key, chunk] of Object.entries(manifest)) {
    if (!chunk.file || !/\.(mjs$js$)/.test(chunk.file)) continue
    const filePath = join(distDir, chunk.file)
    if (!existsSync(filePath)) continue
    const gazip = gzipSize(filePath)
    rows.push({ key, file: chunk.file, gazip, isEntry: isEntry(key, chunk), isVendor: isVendor(key) })

    if (isEntry(key, chunk) && !isVendor(key)) {
      entryGzip += gazip
      entryKey = key
    } else if (isVendor(key)) {
      vendorGazip += gazip
      vendorKeys.push(key)
    } else if (isRouteChunk(key, chunk)) {
      routeKeys.push(key)
    }
  }

  const homeKey = findHomeChunk(manifest)
  const homeRow = homeKey ? rows.find((r) => r.key === homeKey) : null
  const homeGazip = homeRow ? homeRow.gazip : 0
  const firstPaintGazip = entryGzip + vendorGazip + homeGazip

  if (entryGzip > BUDGETS.entryMaxGzipKB * 1024) {
    failures.push(
      `App entry chunk ${entryKey || '?'} is ${formatKB(entryGzip)} kB gzip (budget ${BUDGETS.entryMaxGzipKB} kB)`
    )
  }
  if (firstPaintGazip > BUDGETS.firstPaintMaxGzipKB * 1024) {
    failures.push(
      `First paint of / is ${formatKB(firstPaintGazip)} kB gzip (budget ${BUDGETS.firstPaintMaxGzipKB} kB)`
    )
  }
  for (const key of routeKeys) {
    const row = rows.find((r) => r.key === key)
    if (row && row.gazip > BUDGETS.routeMaxGzipKB * 1024) {
      failures.push(
        `Route chunk ${key} is ${formatKB(row.gazip)} kB gzip (budget ${BUDGETS.routeMaxGzipKB} kB)`
      )
    }
  }

  log('\nBundle size report (gzip):')
  log('-'.repeat(60))
  log(
    `${'Chunk'.padEnd(40)} ${'File'.padEnd(40)} ${'Gzip'.padEnd(10)}`
  )
  for (const row of rows.sort((a, b) => b.gazip - a.gazip)) {
    log(
      `${row.key.padEnd(40)} ${row.file.padEnd(40)} ${formatKB(row.gazip).padEnd(10)}${row.isVendor ? ' [vendor]' : ''}${row.isEntry ? ' [entry]' : ''}`
    )
  }
  log('-'.repeat(60))
  log(`App entry:      ${formatKB(entryGzip)} kB gzip / ${BUDGETS.entryMaxGzipKB} kB budget`)
  log(`First paint (/): ${formatKB(firstPaintGazip)} kB gzip / ${BUDGETS.firstPaintMaxGzipKB} kB budget`)
  log(`Vendor chunks:    ${vendorKeys.length > 0 ? vendorKeys.join(', ') : 'none'}`)
  log(`Route chunks:     ${routeKeys.length > 0 ? routeKeys.join(', ') : 'none'}`)

  if (failures.length > 0) {
    log('\nBundle size budget FAILED:')
    for (const f of failures) log(`  - ${f}`)
    if (options.throwOnError === false) {
      return { ok: false, message: failures.join('\n'), rows, failures }
    }
    process.exit(1)
    return { ok: false, message: failures.join('\n'), rows, failures }
  }

  log('\nBundle size budgets passed.')
  return { ok: true, rows, failures: [] }
}

const isDirectRun = (() => {
  try {
    return process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])
  } catch {
    return false
  }
})()

if (isDirectRun) {
  const distArg = process.argv[2]
  try {
    checkBundleSize(distArg ? { distDir: distArg } : {})
  } catch (err) {
    console.error(err instanceof Error ? err.message : err)
    process.exitCode = 1
  }
}
