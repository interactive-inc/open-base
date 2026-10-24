import { Glob } from "bun"
import { readFileSync } from "node:fs"
import { relative, resolve } from "node:path"
import process from "node:process"
import ts from "typescript"

const PROJECT_ROOT = resolve(import.meta.dir, "..")
const SOURCE_ROOT = resolve(PROJECT_ROOT, "src")

const BIND_PARAMETER_CAST_PATTERN = /\bcast\s*\(\s*\?/iu

export type SqlBindCastViolation = Readonly<{
  file: string
  reason: string
}>

/**
 * D1はbind値をJSの型のまま送るためnumberはREALになりうる。
 * `CAST(?n AS TEXT)`はカラムでなくbind値を変換するため、
 * TEXT affinityカラムとの比較で`1.0`と`'1'`のような不一致を生む。
 */
export function inspectSqlBindCast(file: string, sourceText: string): SqlBindCastViolation[] {
  const violations: SqlBindCastViolation[] = []
  const sourceFile = ts.createSourceFile(
    file,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  )

  function visit(node: ts.Node): void {
    if (
      (ts.isNoSubstitutionTemplateLiteral(node) ||
        ts.isTemplateHead(node) ||
        ts.isTemplateMiddle(node) ||
        ts.isTemplateTail(node) ||
        ts.isStringLiteral(node)) &&
      BIND_PARAMETER_CAST_PATTERN.test(node.text)
    ) {
      violations.push({
        file,
        reason:
          "bindパラメータへのCASTはD1のREAL bindでTEXT affinity比較を壊します。bind側をString(...)で文字列化してください",
      })
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return violations
}

/**
 * src配下の生SQLからbindパラメータへのCASTを検出する。
 * .test.tsも対象に含める（context-boundary検査と異なり除外しない）。
 * テストヘルパーが組み立てるSQL fixtureも同じ不整合を再現しうるため。
 */
export async function collectSqlBindCastViolations(): Promise<SqlBindCastViolation[]> {
  const violations: SqlBindCastViolation[] = []

  for await (const file of new Glob("**/*.{ts,tsx}").scan(SOURCE_ROOT)) {
    const path = resolve(SOURCE_ROOT, file)
    const projectRelativePath = relative(PROJECT_ROOT, path)

    violations.push(...inspectSqlBindCast(projectRelativePath, readFileSync(path, "utf8")))
  }

  return violations
}

if (import.meta.main) {
  const violations = await collectSqlBindCastViolations()

  if (violations.length > 0) {
    for (const violation of violations) console.error(`${violation.file}: ${violation.reason}`)
    process.exit(1)
  }

  console.log("bindパラメータへのCASTがないことを確認しました")
}
