import { createLocalD1Database } from "@system/test/local-d1/create-local-d1-database.test-support"
import { execSql } from "@system/test/local-d1/exec-sql.test-support"
import { describe, expect, setDefaultTimeout, test } from "bun:test"
import { readFileSync } from "node:fs"
import { splitSqlStatements } from "@/lib/database/split-sql-statements"
import { D1CompanyResourceRepository } from "@/contexts/company/infrastructure/repositories/core/d1-company-resource.repository"
import type { CompanyResourceQuery } from "@/contexts/company/infrastructure/repositories/core/d1-company-resource.repository"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"

// ローカルD1の起動とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

const ORGANIZATION_ID = "01900000-0000-7000-8000-0000000000aa"
const AUTUMN = restoreCalendarDate("2026-09-01")

/** 組織と改訂表と、その索引（作り直しを含む）だけを使う。参照整合の trigger を持たないので、版を直接置ける。 */
const schema = splitSqlStatements(
  readFileSync(new URL("../../schema/company.sql", import.meta.url), "utf8"),
)
  .filter(
    (statement) =>
      /CREATE TABLE company_organizations\s*\(/.test(statement) ||
      /CREATE TABLE company_resource_revisions\s*\(/.test(statement) ||
      /CREATE (?:UNIQUE )?INDEX\s+\S+\s+ON company_resource_revisions\b/.test(statement) ||
      /DROP INDEX company_resource_revisions_\w+;?$/.test(statement.trim()),
  )
  .map((statement) => `${statement.trim().replace(/;$/, "")};`)
  .join("\n")

function uuid(sequence: number): string {
  return `01900000-0000-7000-8000-${String(sequence).padStart(12, "0")}`
}

function revisionRow(
  props: Readonly<{
    type: string
    id: string
    revision: number
    organizationRevision: number
    effectiveFrom: string
    attributes: Record<string, string>
  }>,
): string {
  return `('${ORGANIZATION_ID}', '${props.type}', '${props.id}', ${props.revision},
    ${props.organizationRevision}, 'active', '${props.effectiveFrom}',
    '${JSON.stringify(props.attributes)}', 'command', 'actor', 'test', 0)`
}

/**
 * 他の職員 others 人分の link と雇用（各4版）と、2026-06-01 から Account と従業員が付け替わった
 * link と雇用を1件ずつ置く。付け替えた link の2版は会社版 900 と 901、雇用は 901 と 902 で記録する。
 */
async function fixture(others: number) {
  const database = await createLocalD1Database({ schema })
  const rows: string[] = []
  for (const position of Array.from({ length: others }, (_, index) => index)) {
    for (const revision of [1, 2, 3, 4]) {
      rows.push(
        revisionRow({
          type: "account-employee-link",
          id: `link:${position}`,
          revision,
          organizationRevision: position * 4 + revision,
          effectiveFrom: `2026-01-0${revision}`,
          attributes: { accountId: uuid(1000 + position), employeeId: uuid(2000 + position) },
        }),
        revisionRow({
          type: "employment",
          id: `employment:${position}`,
          revision,
          organizationRevision: 10_000 + position * 4 + revision,
          effectiveFrom: `2026-01-0${revision}`,
          attributes: {
            employeeId: uuid(2000 + position),
            status: "ACTIVE",
            employmentType: "FULL_TIME",
          },
        }),
      )
    }
  }
  for (const [revision, suffix] of [
    [1, "before"],
    [2, "after"],
  ] as const) {
    const effectiveFrom = revision === 1 ? "2026-01-01" : "2026-06-01"
    const account = suffix === "before" ? uuid(9001) : uuid(9002)
    const employee = suffix === "before" ? uuid(9003) : uuid(9004)
    rows.push(
      revisionRow({
        type: "account-employee-link",
        id: "link:moved",
        revision,
        organizationRevision: 899 + revision,
        effectiveFrom,
        attributes: { accountId: account, employeeId: employee },
      }),
      revisionRow({
        type: "employment",
        id: "employment:moved",
        revision,
        organizationRevision: 900 + revision,
        effectiveFrom,
        attributes: { employeeId: employee, status: "ACTIVE", employmentType: "FULL_TIME" },
      }),
    )
  }
  const inserts = [
    `INSERT INTO company_organizations (id, revision, created_at, updated_at)
       VALUES ('${ORGANIZATION_ID}', 100000, 0, 0);`,
  ]
  // D1 は1文の長さに上限があるので、版は40行ずつに分けて入れる。
  for (const start of Array.from(
    { length: Math.ceil(rows.length / 40) },
    (_, index) => index * 40,
  )) {
    inserts.push(`INSERT INTO company_resource_revisions
       (organization_id, resource_type, resource_id, revision, organization_revision, state,
        effective_from, attributes_json, command_id, actor_account_id, reason, recorded_at)
       VALUES ${rows.slice(start, start + 40).join(",\n")};`)
  }
  await execSql(database, inserts.join("\n"))

  const rowsRead: number[] = []
  const batch = database.batch.bind(database)
  database.batch = async <T = unknown>(statements: D1PreparedStatement[]) => {
    const results = await batch<T>(statements)
    for (const result of results) rowsRead.push(result.meta.rows_read)
    return results
  }
  return { repository: new D1CompanyResourceRepository({ database }), rowsRead }
}

async function findIds(
  repository: D1CompanyResourceRepository,
  query: CompanyResourceQuery,
): Promise<string[]> {
  const result = await repository.findMany(query)
  if (!result.ok) throw result.cause
  return result.resources.map((resource) => `${resource.id}@${resource.revision}`)
}

describe("属性で絞る Company resource の照会", () => {
  test("付け替え前後の値で引いても、その時点と会社版で選ばれる版だけを返す", async () => {
    const setup = await fixture(20)
    const link = { organizationId: ORGANIZATION_ID, types: ["account-employee-link" as const] }
    const employment = { organizationId: ORGANIZATION_ID, types: ["employment" as const] }

    expect(
      await findIds(setup.repository, {
        ...link,
        accountLinkAccountIds: [uuid(9001)],
        effectiveOn: restoreCalendarDate("2026-03-01"),
      }),
    ).toEqual(["link:moved@1"])
    expect(
      await findIds(setup.repository, {
        ...link,
        accountLinkAccountIds: [uuid(9001)],
        effectiveOn: AUTUMN,
      }),
    ).toEqual([])
    expect(
      await findIds(setup.repository, {
        ...link,
        accountLinkAccountIds: [uuid(9002)],
        effectiveOn: AUTUMN,
      }),
    ).toEqual(["link:moved@2"])
    expect(
      await findIds(setup.repository, {
        ...link,
        accountLinkAccountIds: [uuid(9001)],
        effectiveOn: AUTUMN,
        organizationRevision: 900,
      }),
    ).toEqual(["link:moved@1"])
    expect(
      await findIds(setup.repository, {
        ...link,
        accountLinkEmployeeIds: [uuid(9004), uuid(2007)],
        effectiveOn: AUTUMN,
      }),
    ).toEqual(["link:7@4", "link:moved@2"])
    expect(
      await findIds(setup.repository, {
        ...employment,
        employmentEmployeeIds: [uuid(9003)],
        effectiveOn: AUTUMN,
        organizationRevision: 100000,
      }),
    ).toEqual([])
    expect(
      await findIds(setup.repository, {
        ...employment,
        employmentEmployeeIds: [uuid(9004)],
        effectiveOn: AUTUMN,
        organizationRevision: 100000,
      }),
    ).toEqual(["employment:moved@2"])
  })

  test("他の職員の履歴が増えても、本人の照会が読む行数は変わらない", async () => {
    const queries: CompanyResourceQuery[] = [
      {
        organizationId: ORGANIZATION_ID,
        types: ["account-employee-link"],
        accountLinkAccountIds: [uuid(9002)],
        effectiveOn: AUTUMN,
      },
      {
        organizationId: ORGANIZATION_ID,
        types: ["employment"],
        employmentEmployeeIds: [uuid(9004)],
        effectiveOn: AUTUMN,
        organizationRevision: 100000,
      },
    ]
    const measure = async (others: number) => {
      const setup = await fixture(others)
      for (const query of queries) await findIds(setup.repository, query)
      return setup.rowsRead
    }

    const small = await measure(10)
    const large = await measure(100)

    expect(small).toHaveLength(4)
    expect(large).toEqual(small)
  })
})
