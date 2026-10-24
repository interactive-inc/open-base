import { execSql } from "@system/test/local-d1/exec-sql.test-support"
import { ResponsibilitySourceLedgerAdapter } from "@/contexts/company/infrastructure/adapters/organization/responsibility-source-ledger.adapter"
import { createLocalD1Database } from "@system/test/local-d1/create-local-d1-database.test-support"
import { expect, setDefaultTimeout, test } from "bun:test"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

const source = {
  organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
  sourceContext: "example-app",
  sourceKind: "example-record",
} as const

async function createDatabase(): Promise<D1Database> {
  const database = await createLocalD1Database({ schema: "" })
  await execSql(
    database,
    `CREATE TABLE company_responsibility_source_adoptions (
    organization_id TEXT, source_context TEXT, source_kind TEXT, source_namespace TEXT, freeze_id TEXT,
    source_id TEXT, source_version TEXT, command_id TEXT, resource_type TEXT, resource_id TEXT,
    resource_revision INTEGER, snapshot_digest TEXT, source_json TEXT, actor_account_id TEXT, reason TEXT,
    expected_revision INTEGER, organization_revision INTEGER, recorded_at INTEGER)`,
  )
  await execSql(
    database,
    `CREATE TABLE company_responsibility_source_cutovers (
    organization_id TEXT, source_context TEXT, source_kind TEXT, source_namespace TEXT, freeze_id TEXT,
    source_count INTEGER, adopted_count INTEGER, source_manifest_digest TEXT, source_manifest_json TEXT,
    audit_event_id TEXT, actor_account_id TEXT, completed_at INTEGER)`,
  )
  return database
}

function adoption(sourceId: string, sourceContext: string = source.sourceContext) {
  return {
    ...source,
    sourceContext,
    sourceNamespace: "namespace",
    freezeId: "freeze",
    sourceId,
    snapshotDigest: `digest:${sourceId}`,
    sourceJson: "{}",
    commandId: `command:${sourceId}`,
    resourceId: `assignment:${sourceId}`,
    resourceRevision: 1,
    actorAccountId: "account",
    reason: "Confirmed history",
    expectedRevision: 3,
    organizationRevision: 4,
    recordedAt: 10,
  }
}

test("接続記録は保存元の版へsnapshot digestを保存し、保存元の種類ごとに数値順で返す", async () => {
  const database = await createDatabase()
  const ledger = new ResponsibilitySourceLedgerAdapter(database)
  await database.batch([
    ledger.prepareAdoption(adoption("10")),
    ledger.prepareAdoption(adoption("2")),
    ledger.prepareAdoption(adoption("1", "other-app")),
  ])

  expect(
    await ledger.listAdoptedSources({
      ...source,
      sourceNamespace: "namespace",
      freezeId: "freeze",
    }),
  ).toEqual([
    { sourceId: "2", sourceVersion: "digest:2" },
    { sourceId: "10", sourceVersion: "digest:10" },
  ])
})

test("接続完了の受領記録は接続件数を保存元の件数と同じ値で保存する", async () => {
  const database = await createDatabase()
  const ledger = new ResponsibilitySourceLedgerAdapter(database)

  expect(await ledger.findCutover(source)).toBeNull()
  await database.batch([
    ledger.prepareCutover({
      ...source,
      sourceNamespace: "namespace",
      freezeId: "freeze",
      sourceCount: 2,
      manifestDigest: "manifest-digest",
      manifestJson: "[]",
      auditEventId: "audit",
      actorAccountId: "account",
      completedAt: 20,
    }),
  ])

  expect(await ledger.findCutover(source)).toEqual({
    freeze_id: "freeze",
    source_count: 2,
    adopted_count: 2,
    source_manifest_digest: "manifest-digest",
    completed_at: 20,
  })
  expect(await ledger.findCutover({ ...source, sourceKind: "other-record" })).toBeNull()
})
