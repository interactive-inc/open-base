import { execSql } from "@system/test/local-d1/exec-sql.test-support"
import { PersonnelActionRequestLedgerAdapter } from "@/contexts/company/infrastructure/adapters/employee-lifecycle/personnel-action-request-ledger.adapter"
import { createLocalD1Database } from "@system/test/local-d1/create-local-d1-database.test-support"
import { expect, setDefaultTimeout, test } from "bun:test"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

async function createDatabase(): Promise<D1Database> {
  const database = await createLocalD1Database({ schema: "" })
  await execSql(
    database,
    "CREATE TABLE system_proposal_numbers (series_id TEXT PRIMARY KEY, number INTEGER)",
  )
  await execSql(
    database,
    `CREATE TABLE company_personnel_action_requests (
    id TEXT PRIMARY KEY, application_id INTEGER NOT NULL, system_proposal_series_id TEXT,
    target_employee_id TEXT, subject_snapshot_json TEXT, target_department_code TEXT, kind TEXT,
    payload_json TEXT, payload_fingerprint TEXT, requested_by_employee_id TEXT,
    base_employee_revision INTEGER, base_organization_revision INTEGER, base_company_revision INTEGER,
    created_at INTEGER, applied_action_id TEXT, withdrawn_at INTEGER)`,
  )
  await execSql(
    database,
    "INSERT INTO system_proposal_numbers VALUES ('series-1', 41), ('series-2', 42)",
  )
  return database
}

function record(id: string, seriesId: string, createdAt: number) {
  return {
    id,
    systemProposalSeriesId: seriesId,
    targetEmployeeId: null,
    subjectSnapshotJson: '{"employeeCode":"E900","employeeName":"Example Person"}',
    targetDepartmentCode: "D001",
    kind: "hire",
    payloadJson: "{}",
    payloadFingerprint: "f".repeat(64),
    requestedByEmployeeId: "1",
    baseEmployeeRevision: 0,
    baseOrganizationRevision: 3,
    baseCompanyRevision: 5,
    createdAt,
  }
}

test("申請番号は同じ系列で採番された提案番号を保存し、一覧は新しい順で申請時の対象者を返す", async () => {
  const database = await createDatabase()
  const ledger = new PersonnelActionRequestLedgerAdapter(database)
  await database.batch([
    ledger.prepareInsert(record("request-1", "series-1", 100)),
    ledger.prepareInsert(record("request-2", "series-2", 200)),
  ])

  const rows = await ledger.list()
  if (rows instanceof Error) throw rows

  expect(rows.map((row) => [row.id, row.application_id])).toEqual([
    ["request-2", 42],
    ["request-1", 41],
  ])
  expect(rows[0]).toMatchObject({
    target_employee_code: "E900",
    target_employee_name: "Example Person",
    base_company_revision: 5,
    applied_action_id: null,
    withdrawn_at: null,
  })
})

test("採番のない系列では申請を保存しない", async () => {
  const database = await createDatabase()
  const ledger = new PersonnelActionRequestLedgerAdapter(database)

  await expect(
    database.batch([ledger.prepareInsert(record("request-3", "series-missing", 300))]),
  ).rejects.toThrow()
  expect(await ledger.list()).toEqual([])
})

test("保存先を参照できない場合は空の一覧で補わず失敗を返す", async () => {
  const ledger = new PersonnelActionRequestLedgerAdapter(
    await createLocalD1Database({ schema: "" }),
  )

  expect(await ledger.list()).toBeInstanceOf(Error)
})
