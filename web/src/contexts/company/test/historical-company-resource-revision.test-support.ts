import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { splitSqlStatements } from "@/lib/database/split-sql-statements"
import { COMPANY_TEST_MIGRATIONS_DIR } from "@/contexts/company/test/migrations-directory.test-support"

const auditMigrationSuffixes = [
  "_record_company_resource_evidence_references.sql",
  "_record_company_resource_correction_targets.sql",
] as const

/**
 * 過去のmigrationを検証するfixtureで現行writerを使うため、追記専用の監査列だけ先に適用する。
 * 実migrationのSQLをそのまま使い、返したファイルは後続の再適用から除く。
 */
export async function prepareHistoricalCompanyResourceRevisionFixture(
  database: D1Database,
): Promise<ReadonlySet<string>> {
  const columns = new Set(
    (
      await database
        .prepare("PRAGMA table_info(company_resource_revisions)")
        .all<{ name: string }>()
    ).results.map((row) => row.name),
  )
  const migrationFiles = readdirSync(COMPANY_TEST_MIGRATIONS_DIR)
  const applied = new Set<string>()
  for (const [suffix, column] of [
    [auditMigrationSuffixes[0], "evidence_references_json"],
    [auditMigrationSuffixes[1], "corrects_revision"],
  ] as const) {
    if (columns.has(column)) continue
    const matches = migrationFiles.filter((file) => file.endsWith(suffix))
    if (matches.length !== 1) throw new Error(`Expected one Company audit migration: ${suffix}`)
    const file = matches[0]!
    await database.batch(
      splitSqlStatements(readFileSync(join(COMPANY_TEST_MIGRATIONS_DIR, file), "utf8")).map(
        (statement) => database.prepare(statement),
      ),
    )
    applied.add(file)
  }
  return applied
}
