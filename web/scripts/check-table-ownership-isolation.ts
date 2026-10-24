import { Database } from "bun:sqlite"
import { Glob } from "bun"
import { readdirSync, readFileSync } from "node:fs"
import { relative, resolve } from "node:path"
import process from "node:process"
import ts from "typescript"
import { executeSql } from "./sql-statements"

const PROJECT_ROOT = resolve(import.meta.dir, "..")
const CONTEXTS_ROOT = resolve(PROJECT_ROOT, "src", "contexts")
const MIGRATIONS_ROOT = resolve(PROJECT_ROOT, "migrations")

const TABLE_DECLARATION_PATTERN = /sqliteTable\(\s*["'`]([a-z][a-z0-9_]*)["'`]/gu
const TABLE_REFERENCE_PATTERN =
  /\b(?:from|join|into|update|references|table(?:\s+if\s+(?:not\s+)?exists)?)\s+["`]?([a-z][a-z0-9_]*)/giu

export type TableOwnershipViolation = Readonly<{
  file: string
  reason: string
}>

function isTestFile(file: string): boolean {
  return /\.test\.tsx?$|\.test-support\.ts$|(^|\/)test\//u.test(file)
}

/**
 * 依存方向は 業務 -> company -> system の一方向とする。
 * 同じcontextは常に許可し、業務から別の業務、基盤から業務、systemからcompanyを拒否する。
 */
export function canOwnerReference(source: string, target: string): boolean {
  if (source === target || target === "system") return true
  return target === "company" && source !== "system"
}

/** production sourceの宣言を優先し、宣言のないtableはcontext名の最長接頭辞で所有者を決める。 */
export function resolveTableOwner(
  table: string,
  declaredOwners: ReadonlyMap<string, string>,
  contexts: ReadonlyArray<string>,
): string | null {
  const declared = declaredOwners.get(table)
  if (declared !== undefined) return declared
  const candidates = contexts
    .filter((context) => table.startsWith(`${context.replaceAll("-", "_")}_`))
    .sort((left, right) => right.length - left.length)
  return candidates[0] ?? null
}

const FOUNDATION_CONTEXTS: ReadonlySet<string> = new Set(["system", "company"])
const SOFT_REFERENCE_COLUMN_PATTERN = /^([a-z][a-z0-9_]*)_(?:id|code|key|number)$/u

function referencedTableNames(stem: string): string[] {
  return [stem, `${stem}s`, `${stem}es`, stem.replace(/y$/u, "ies")]
}

/**
 * 外部キーを持たない列名だけの参照も、別の業務の記録を指していれば直接依存として拒否する。
 * `<記録>_id` や `<記録>_code` の記録名が、別の業務が所有するtable名と一致する列を検出する。
 * 業務間の関連は所有contextが解釈しない不透明な参照か、API compositionのread modelで表す。
 */
export function inspectSoftReferences(
  table: string,
  owner: string,
  columns: ReadonlyArray<string>,
  owners: ReadonlyMap<string, string>,
): TableOwnershipViolation[] {
  if (FOUNDATION_CONTEXTS.has(owner)) return []
  const violations: TableOwnershipViolation[] = []
  for (const column of columns) {
    const stem = SOFT_REFERENCE_COLUMN_PATTERN.exec(column)?.[1]
    if (stem === undefined) continue
    const names = referencedTableNames(stem)
    const referenced = [...owners].find(
      ([candidate, target]) =>
        target !== owner && !FOUNDATION_CONTEXTS.has(target) && names.includes(candidate),
    )
    if (referenced === undefined) continue
    violations.push({
      file: "migrations",
      reason: `${owner} の ${table}.${column} が ${referenced[1]} の ${referenced[0]} を列名で参照しています`,
    })
  }
  return violations
}

const API_COMPOSITION = "api-composition"

/**
 * CompanyのtableをSQLで直接読む、解消待ちのfile。現在は0件で、増やさない。
 * 移行の途中でやむを得ず置くときだけ、理由のコメントとともにpathを追加する。
 */
const PENDING_COMPANY_TABLE_READS: ReadonlySet<string> = new Set<string>()

/** 業務はCompanyの保存先を公開operation経由で使う。外部キーによる参照整合性は許可する。 */
export function canSourceQueryOwner(file: string, source: string, target: string): boolean {
  // API compositionは複数contextのread modelを束ねるため、業務とSystemのtableは読める。
  if (source !== API_COMPOSITION && !canOwnerReference(source, target)) return false
  if (target !== "company" || source === "company") return true
  return PENDING_COMPANY_TABLE_READS.has(file)
}

/** SQL文字列が参照するtableのうち、所有者が依存方向に反するものを検出する。 */
export function inspectTableReferences(
  file: string,
  sourceContext: string,
  sourceText: string,
  owners: ReadonlyMap<string, string>,
): TableOwnershipViolation[] {
  const violations = new Map<string, TableOwnershipViolation>()
  const sourceFile = ts.createSourceFile(file, sourceText, ts.ScriptTarget.Latest, true)

  function visit(node: ts.Node): void {
    if (
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node) ||
      ts.isStringLiteral(node)
    ) {
      for (const match of node.text.matchAll(TABLE_REFERENCE_PATTERN)) {
        const table = match[1]?.toLowerCase()
        if (table === undefined) continue
        const owner = owners.get(table)
        if (owner === undefined || canSourceQueryOwner(file, sourceContext, owner)) continue
        violations.set(table, {
          file,
          reason: `${sourceContext} が ${owner} の table を SQL で直接参照しています: ${table}`,
        })
      }
    }
    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return [...violations.values()]
}

function listContexts(): string[] {
  return readdirSync(CONTEXTS_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
}

async function listProductionSources(): Promise<{ context: string; path: string }[]> {
  const sources: { context: string; path: string }[] = []
  for await (const file of new Glob("**/*.ts").scan(CONTEXTS_ROOT)) {
    if (isTestFile(file)) continue
    const context = file.split("/")[0]
    if (context === undefined) continue
    sources.push({ context, path: resolve(CONTEXTS_ROOT, file) })
  }
  return sources
}

/**
 * 全migrationを適用した構造とproduction sourceのSQLを照合する。
 * import境界の検査はSQL文字列と外部キーによる他contextへの依存を検出できないため、
 * 業務contextの物理除去が他の業務と基盤のtableを壊さないことをここで固定する。
 */
/** 全 migration を当てた DB を返す。検査は既定でこれを使い、test は同じ状態の複製を渡せる。 */
function migrateAll(): Database {
  const database = new Database(":memory:")
  const migrationFiles = readdirSync(MIGRATIONS_ROOT)
    .filter((file) => file.endsWith(".sql"))
    .sort()
  for (const file of migrationFiles)
    executeSql(database, readFileSync(resolve(MIGRATIONS_ROOT, file), "utf8"), `migration ${file}`)
  return database
}

export async function collectTableOwnershipViolations(
  database: Database = migrateAll(),
): Promise<TableOwnershipViolation[]> {
  const violations: TableOwnershipViolation[] = []
  const contexts = listContexts()
  const sources = await listProductionSources()

  const declaredOwners = new Map<string, string>()
  for (const source of sources) {
    for (const match of readFileSync(source.path, "utf8").matchAll(TABLE_DECLARATION_PATTERN)) {
      const table = match[1]
      if (table !== undefined && !declaredOwners.has(table))
        declaredOwners.set(table, source.context)
    }
  }

  const tables = database
    .query<{ name: string }, []>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '\\_cf\\_%' ESCAPE '\\' ORDER BY name",
    )
    .all()
    .map((row) => row.name)

  const owners = new Map<string, string>()
  for (const table of tables) {
    const owner = resolveTableOwner(table, declaredOwners, contexts)
    if (owner === null) {
      violations.push({
        file: "migrations",
        reason: `所有contextを決定できない table です: ${table}`,
      })
      continue
    }
    owners.set(table, owner)
  }

  for (const [table, owner] of owners) {
    const foreignKeys = database
      .query<{ table: string }, []>(`PRAGMA foreign_key_list("${table}")`)
      .all()
    for (const foreignKey of foreignKeys) {
      const target = owners.get(foreignKey.table)
      if (target === undefined || canOwnerReference(owner, target)) continue
      violations.push({
        file: "migrations",
        reason: `${owner} の ${table} が ${target} の ${foreignKey.table} へ外部キーで依存しています`,
      })
    }
    const columns = database
      .query<{ name: string }, []>(`PRAGMA table_info("${table}")`)
      .all()
      .map((column) => column.name)
    violations.push(...inspectSoftReferences(table, owner, columns, owners))
  }

  for await (const file of new Glob("**/*.ts").scan(resolve(PROJECT_ROOT, "src", "api"))) {
    if (isTestFile(file)) continue
    sources.push({ context: API_COMPOSITION, path: resolve(PROJECT_ROOT, "src", "api", file) })
  }

  for (const source of sources) {
    violations.push(
      ...inspectTableReferences(
        relative(PROJECT_ROOT, source.path),
        source.context,
        readFileSync(source.path, "utf8"),
        owners,
      ),
    )
  }

  return violations
}

if (import.meta.main) {
  const violations = await collectTableOwnershipViolations()

  if (violations.length > 0) {
    for (const violation of violations) console.error(`${violation.file}: ${violation.reason}`)
    process.exit(1)
  }

  console.log("table の所有境界が 業務 -> company -> system の一方向であることを確認しました")
}
