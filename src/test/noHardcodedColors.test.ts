import { readdirSync, readFileSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const sourceRoot = resolve(process.cwd(), 'src')
const colorDefinitionAllowlist = new Set(['src/index.css'])
const hexColorPattern = /#[\da-f]{3,4}\b|#[\da-f]{6}(?:[\da-f]{2})?\b/gi

function getCssFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name)

    if (entry.isDirectory()) {
      return getCssFiles(path)
    }

    return entry.isFile() && entry.name.endsWith('.css') ? [path] : []
  })
}

describe('CSS color tokens', () => {
  it('does not use raw hex colors outside the token definitions', () => {
    const violations = getCssFiles(sourceRoot).flatMap((filePath) => {
      const relativePath = relative(process.cwd(), filePath).replace(/\\/g, '/')

      if (colorDefinitionAllowlist.has(relativePath)) {
        return []
      }

      const css = readFileSync(filePath, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
      const matches = [...css.matchAll(hexColorPattern)]

      return matches.map((match) => {
        const line = css.slice(0, match.index).split('\n').length
        return `${relativePath}:${line} ${match[0]}`
      })
    })

    expect(violations).toEqual([])
  })
})
