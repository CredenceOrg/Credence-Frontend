import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import * as ts from 'typescript'
import { describe, expect, it } from 'vitest'

interface LinkViolation {
  file: string
  line: number
  target: string
}

function readStringLiteral(
  node: ts.Expression | ts.JsxAttributeValue | undefined
): string | undefined {
  if (!node) return undefined
  if (ts.isStringLiteralLike(node)) return node.text
  if (ts.isJsxExpression(node) && node.expression && ts.isStringLiteralLike(node.expression)) {
    return node.expression.text
  }
  return undefined
}

function propertyName(name: ts.PropertyName): string | undefined {
  if (ts.isIdentifier(name) || ts.isStringLiteralLike(name)) return name.text
  return undefined
}

function inspectOpeningElement(
  sourceFile: ts.SourceFile,
  element: ts.JsxOpeningElement | ts.JsxSelfClosingElement,
  file: string
): LinkViolation[] {
  const directTargets: Array<{ value: string; position: number }> = []
  const relValues: string[] = []
  const violations: LinkViolation[] = []

  for (const attribute of element.attributes.properties) {
    if (!ts.isJsxAttribute(attribute)) continue
    const name = ts.isIdentifier(attribute.name) ? attribute.name.text : undefined
    if (name === 'target') {
      const value = readStringLiteral(attribute.initializer)
      if (value) directTargets.push({ value, position: attribute.getStart(sourceFile) })
    }
    if (name === 'rel') {
      const value = readStringLiteral(attribute.initializer)
      if (value) relValues.push(value)
    }
  }

  for (const attribute of element.attributes.properties) {
    if (ts.isJsxSpreadAttribute(attribute)) {
      const visitSpread = (node: ts.Node) => {
        if (ts.isObjectLiteralExpression(node)) {
          const targets: Array<{ value: string; position: number }> = []
          const spreadRelValues: string[] = []

          for (const property of node.properties) {
            if (!ts.isPropertyAssignment(property)) continue
            const name = propertyName(property.name)
            const value = readStringLiteral(property.initializer)
            if (name === 'target' && value) {
              targets.push({ value, position: property.initializer.getStart(sourceFile) })
            }
            if (name === 'rel' && value) spreadRelValues.push(value)
          }

          const spreadRelTokens = new Set(
            [...relValues, ...spreadRelValues].flatMap((rel) => rel.toLowerCase().split(/\s+/))
          )
          if (!spreadRelTokens.has('noopener') || !spreadRelTokens.has('noreferrer')) {
            violations.push(
              ...targets
                .filter(({ value }) => value === '_blank')
                .map(({ position, value }) => ({
                  file,
                  line: sourceFile.getLineAndCharacterOfPosition(position).line + 1,
                  target: value,
                }))
            )
          }
        }
        ts.forEachChild(node, visitSpread)
      }
      visitSpread(attribute.expression)
    }
  }

  const relTokens = new Set(relValues.flatMap((rel) => rel.toLowerCase().split(/\s+/)))
  if (relTokens.has('noopener') && relTokens.has('noreferrer')) return violations

  return [
    ...violations,
    ...directTargets
    .filter(({ value }) => value === '_blank')
    .map(({ position, value }) => ({
      file,
      line: sourceFile.getLineAndCharacterOfPosition(position).line + 1,
      target: value,
    })),
  ]
}

function findViolationsInSource(source: string, file: string): LinkViolation[] {
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  )
  const violations: LinkViolation[] = []

  const visit = (node: ts.Node) => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      violations.push(...inspectOpeningElement(sourceFile, node, file))
    }
    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return violations
}

async function findTsxFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory() && entry.name !== '__tests__')
      .map((entry) => findTsxFiles(path.join(directory, entry.name)))
  )

  const files = entries
    .filter(
      (entry) =>
        entry.isFile() &&
        entry.name.endsWith('.tsx') &&
        !entry.name.endsWith('.test.tsx') &&
        !entry.name.endsWith('.spec.tsx')
    )
    .map((entry) => path.join(directory, entry.name))

  return [...files, ...nested.flat()]
}

describe('external links', () => {
  it('requires noopener and noreferrer on every link opened in a new tab', async () => {
    const srcDirectory = path.resolve(process.cwd(), 'src')
    const files = await findTsxFiles(srcDirectory)
    const violations = (
      await Promise.all(
        files.map(async (file) => findViolationsInSource(await readFile(file, 'utf8'), file))
      )
    ).flat()

    expect(
      violations.map(
        ({ file, line, target }) =>
          `${path.relative(process.cwd(), file)}:${line} target="${target}"`
      ),
      'New-tab links must specify rel="noopener noreferrer" on the same element'
    ).toEqual([])
  })

  it('detects a new-tab link without safe rel tokens', () => {
    const violations = findViolationsInSource(
      '<a href="/external" target="_blank">Open</a>',
      'fixture.tsx'
    )
    expect(violations).toHaveLength(1)
  })
})
