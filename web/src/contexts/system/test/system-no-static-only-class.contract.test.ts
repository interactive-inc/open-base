import { Glob } from "bun"
import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import ts from "typescript"

const systemRoot = resolve(import.meta.dir, "..")

test("Systemではclassをstatic関数の名前空間として使わない", async () => {
  const violations: string[] = []

  for await (const path of new Glob("**/*.ts").scan({ cwd: systemRoot })) {
    const source = ts.createSourceFile(
      path,
      readFileSync(resolve(systemRoot, path), "utf8"),
      ts.ScriptTarget.Latest,
      true,
    )

    const visit = (node: ts.Node): void => {
      if (ts.isClassDeclaration(node) && node.name !== undefined && node.members.length > 0) {
        const hasInstanceMember = node.members.some((member) => {
          const modifiers = ts.canHaveModifiers(member) ? ts.getModifiers(member) : undefined
          return !modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.StaticKeyword)
        })

        if (!hasInstanceMember) {
          const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1
          violations.push(`${path}:${line}: ${node.name.text}`)
        }
      }

      ts.forEachChild(node, visit)
    }

    visit(source)
  }

  expect(violations).toEqual([])
})
