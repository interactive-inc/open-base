import {
  COMPANY_DEFAULT_ORGANIZATION_ID,
  COMPANY_ROOT_ORGANIZATION_UNIT_ID,
} from "@/contexts/company/domain/definitions/company-organization-identity.definition"
import { deterministicCompanyId } from "@/contexts/company/domain/definitions/deterministic-company-id.definition"
import { companyOperationId } from "@/contexts/company/domain/definitions/company-operation-id.definition"

const LEGACY_ORGANIZATION_ID = "organization:default"
const LEGACY_ROOT_ORGANIZATION_UNIT_ID = "company:root"

/**
 * 組織の ID を UUID へ移す前の schema で過去の migration を検査するとき、現行の書込みは既知の UUID の
 * 組織と最上位の組織単位を使う。検査用の DB に限り、schema と行に埋め込まれた旧来の ID を
 * 既知の UUID へ置き換え、過去の schema の形のまま現行の書込みを受け付けるようにする。
 * 移行後の schema では何もしない。
 */
export async function alignHistoricalOrganizationIdentity(database: D1Database): Promise<void> {
  const legacy = await database
    .prepare("SELECT 1 AS found FROM company_organizations WHERE id = ?1")
    .bind(LEGACY_ORGANIZATION_ID)
    .first<{ found: number }>()
  if (legacy === null) return
  const replaced = (sql: string) =>
    sql.replaceAll(`'${LEGACY_ORGANIZATION_ID}'`, `'${COMPANY_DEFAULT_ORGANIZATION_ID}'`)
  const objects = async (type: "trigger" | "view") =>
    (
      await database
        .prepare("SELECT name, sql FROM sqlite_master WHERE type = ?1 ORDER BY rowid")
        .bind(type)
        .all<{ name: string; sql: string }>()
    ).results
  const columnsOf = async (table: string) =>
    (
      await database
        .prepare("SELECT name FROM pragma_table_info(?1)")
        .bind(table)
        .all<{ name: string }>()
    ).results.map((column) => column.name)
  const triggers = await objects("trigger")
  const views = await objects("view")
  // ローカルD1は外部キーを止められないため、作り直しと置換を1つのbatchにまとめ、検査を確定時まで遅らせる。
  const statements: D1PreparedStatement[] = [database.prepare("PRAGMA defer_foreign_keys = ON")]
  for (const trigger of triggers) statements.push(database.prepare(`DROP TRIGGER ${trigger.name}`))
  for (const view of views) statements.push(database.prepare(`DROP VIEW ${view.name}`))
  // 旧来の組織 ID を埋め込んだ table は、置き換えた定義で作り直して行を戻す。
  const embedded = (
    await database
      .prepare(
        "SELECT name, sql FROM sqlite_master WHERE type = 'table' AND sql LIKE '%''organization:default''%'",
      )
      .all<{ name: string; sql: string }>()
  ).results
  for (const table of embedded) {
    const indexes = (
      await database
        .prepare(
          "SELECT sql FROM sqlite_master WHERE type = 'index' AND tbl_name = ?1 AND sql IS NOT NULL",
        )
        .bind(table.name)
        .all<{ sql: string }>()
    ).results
    const aligned = `__aligned_${table.name}`
    const definition = replaced(table.sql).replace(
      /^CREATE TABLE\s+("?)[A-Za-z0-9_]+\1/u,
      `CREATE TABLE "${aligned}"`,
    )
    statements.push(
      database.prepare(definition),
      database.prepare(`INSERT INTO "${aligned}" SELECT * FROM "${table.name}"`),
      database.prepare(`DROP TABLE "${table.name}"`),
      database.prepare(`ALTER TABLE "${aligned}" RENAME TO "${table.name}"`),
      ...indexes.map((index) => database.prepare(index.sql)),
    )
  }

  const tables = (
    await database
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite\\_%' ESCAPE '\\' AND name NOT LIKE '\\_cf\\_%' ESCAPE '\\'",
      )
      .all<{ name: string }>()
  ).results
  for (const { name } of tables) {
    // role の key の company:root は IAM の業務コードで、組織単位の ID ではない。
    if (name === "system_iam_roles") continue
    for (const column of await columnsOf(name)) {
      statements.push(
        database
          .prepare(
            `UPDATE "${name}" SET "${column}" = CASE "${column}"
             WHEN ?1 THEN ?2 WHEN ?3 THEN ?4
             ELSE replace(replace("${column}", '"' || ?1 || '"', '"' || ?2 || '"'), '"' || ?3 || '"', '"' || ?4 || '"') END
           WHERE typeof("${column}") = 'text' AND ("${column}" IN (?1, ?3) OR instr("${column}", '"' || ?1 || '"') > 0 OR instr("${column}", '"' || ?3 || '"') > 0)`,
          )
          .bind(
            LEGACY_ORGANIZATION_ID,
            COMPANY_DEFAULT_ORGANIZATION_ID,
            LEGACY_ROOT_ORGANIZATION_UNIT_ID,
            COMPANY_ROOT_ORGANIZATION_UNIT_ID,
          ),
        // 初期データの操作と組織期間の ID も、現行の書込みが照合する UUID へ揃える。
        database
          .prepare(
            `UPDATE "${name}" SET "${column}" = CASE "${column}"
             WHEN ?1 THEN ?2 WHEN ?3 THEN ?4 WHEN ?5 THEN ?6 END
           WHERE "${column}" IN (?1, ?3, ?5)`,
          )
          .bind(
            "initialization:organization:default",
            companyOperationId("initialization:organization:default"),
            "initialization:company:root",
            companyOperationId("initialization:company:root"),
            "company:root:initial",
            deterministicCompanyId("initial-period", "company:root:initial"),
          ),
      )
    }
  }
  // 現行の書込みは legacy_id の列を含めて組織と組織単位を読み書きするため、検査用に空の列だけを足す。
  for (const table of ["company_organizations", "company_organization_units"]) {
    if (!(await columnsOf(table)).includes("legacy_id"))
      statements.push(database.prepare(`ALTER TABLE ${table} ADD COLUMN legacy_id TEXT`))
  }
  // 操作の ID を UUID へ移す前の schema には旧来の鍵の列が無い。現行の書込みが渡すため、空の列だけを足す。
  if (!(await columnsOf("company_organization_change_operations")).includes("operation_key"))
    statements.push(
      database.prepare(
        "ALTER TABLE company_organization_change_operations ADD COLUMN operation_key TEXT",
      ),
    )
  for (const view of views) statements.push(database.prepare(replaced(view.sql)))
  for (const trigger of triggers) statements.push(database.prepare(replaced(trigger.sql)))
  await database.batch(statements)
}

/**
 * 組織の ID を揃えた検査用の DB へ後続の migration を当てるとき、migration の SQL が埋め込む旧来の組織 ID を
 * 既知の UUID へ読み替える。揃えた DB の CHECK・trigger と同じ値にするため。
 */
export function alignHistoricalMigrationSql(sql: string): string {
  return sql.replaceAll(`'${LEGACY_ORGANIZATION_ID}'`, `'${COMPANY_DEFAULT_ORGANIZATION_ID}'`)
}
