import { SYSTEM_AUDIT_ACTIONS } from "@system/domain/catalogs/audit/system-audit-action.catalog"
import { ExternalAssertionEntity } from "@system/domain/entities/external-assertion.entity"
import { ReconciliationRunEntity } from "@system/domain/entities/reconciliation-run.entity"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { SystemAuditEventRepository } from "@system/infrastructure/repositories/audit/system-audit-event.repository"
import { SystemReconciliationRepository } from "@system/infrastructure/repositories/integration/system-reconciliation.repository"
import { execSql } from "@system/test/local-d1/exec-sql.test-support"
import { SystemSessionTestContext } from "@system/test/system-session-test-context.test-support"
import { describe, expect, setDefaultTimeout, test } from "bun:test"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

const digestA = "a".repeat(64)
const digestB = "b".repeat(64)
const observedAt = new Date("2026-01-01T00:00:00.000Z")
const firstReceivedAt = new Date("2026-01-01T00:00:01.000Z")
const secondReceivedAt = new Date("2026-01-01T00:00:02.000Z")

describe("SystemReconciliationRepository", () => {
  test("外部の版が同じままでも、ローカルの版を進めた照合を同じassertionへ追加する", async () => {
    const fixture = await createFixture()
    const repository = new SystemReconciliationRepository(fixture.context)

    expect(
      await repository.write(createAssertion({}), createRun({ localDigest: digestA })),
    ).toMatchObject({ kind: "written", run: { status: "mismatched" } })
    const assertionsAfterFirst = await assertionRows(fixture)

    expect(
      await repository.write(
        createAssertion({ receivedAt: secondReceivedAt }),
        createRun({
          id: "d8f0b2c4-5e7a-4f9b-a1d3-4e6a8b0c2d5f",
          localVersion: "8",
          localDigest: digestB,
          createdAt: secondReceivedAt,
        }),
      ),
    ).toMatchObject({ kind: "written", run: { status: "matched", localVersion: "8" } })

    expect(await assertionRows(fixture)).toEqual(assertionsAfterFirst)
    expect(assertionsAfterFirst).toEqual([
      {
        id: "3e5a7c9b-2d4f-4b6a-a8c0-1e3f5a7b9c2d",
        connector_id: "6f1c2a0e-5b7d-4c3a-9e21-8a4d0b6c7e15",
        exchange_id: "b2d4f6a8-1c3e-4a5b-8c7d-9e0f1a2b3c4d",
        external_key: "record:1",
        external_version: "1",
        payload_digest: digestB,
        observed_at: observedAt.getTime(),
        received_at: firstReceivedAt.getTime(),
      },
    ])
    expect(await runRows(fixture)).toEqual([
      {
        id: "c7e9a1b3-4d6f-4e8a-b0c2-3d5f7a9b1c4e",
        assertion_id: "3e5a7c9b-2d4f-4b6a-a8c0-1e3f5a7b9c2d",
        local_version: "7",
        status: "mismatched",
      },
      {
        id: "d8f0b2c4-5e7a-4f9b-a1d3-4e6a8b0c2d5f",
        assertion_id: "3e5a7c9b-2d4f-4b6a-a8c0-1e3f5a7b9c2d",
        local_version: "8",
        status: "matched",
      },
    ])
    expect(await repository.findMany("b2d4f6a8-1c3e-4a5b-8c7d-9e0f1a2b3c4d")).toMatchObject([
      { id: "d8f0b2c4-5e7a-4f9b-a1d3-4e6a8b0c2d5f", status: "matched", item_count: 1 },
      { id: "c7e9a1b3-4d6f-4e8a-b0c2-3d5f7a9b1c4e", status: "mismatched", item_count: 1 },
    ])
  })

  test("保存済みのassertionと違う外部の事実を渡す照合は競合として拒否し、assertionを変えない", async () => {
    const fixture = await createFixture()
    const repository = new SystemReconciliationRepository(fixture.context)
    expect(
      await repository.write(createAssertion({}), createRun({ localDigest: digestA })),
    ).toMatchObject({ kind: "written" })
    const stored = await storedState(fixture)

    const differentFacts = [
      createAssertion({ payloadDigest: digestA }),
      createAssertion({ observedAt: new Date(observedAt.getTime() + 1) }),
      createAssertion({ id: "4f6b8d0c-3e5a-4c7b-b9d1-2f4a6b8c0d3e" }),
      createAssertion({ externalVersion: "2" }),
      createAssertion({ externalKey: "record:2" }),
      createAssertion({ exchangeId: "a1c3e5b7-9d0f-4b2a-8c4e-6f8a0b2c4d6e" }),
    ]

    for (const assertion of differentFacts) {
      const run = createRun({
        id: "d8f0b2c4-5e7a-4f9b-a1d3-4e6a8b0c2d5f",
        exchangeId: assertion.exchangeId ?? "b2d4f6a8-1c3e-4a5b-8c7d-9e0f1a2b3c4d",
        assertionId: assertion.id,
        localVersion: "8",
        localDigest: digestB,
      })
      expect(await repository.write(assertion, run)).toEqual({ kind: "conflict" })
      expect(await storedState(fixture)).toEqual(stored)
    }
  })

  test("assertionの初回の作成が競合しても、保存済みの事実との一致を確かめて照合を追加する", async () => {
    const fixture = await createFixture()
    const competitor = new SystemReconciliationRepository(fixture.context)
    const racing = createRacingDatabase(fixture.database, async () => {
      expect(
        await competitor.write(createAssertion({}), createRun({ localDigest: digestA })),
      ).toMatchObject({ kind: "written" })
    })
    const repository = new SystemReconciliationRepository({ env: { DB: racing.database } })

    expect(
      await repository.write(
        createAssertion({ receivedAt: secondReceivedAt }),
        createRun({
          id: "d8f0b2c4-5e7a-4f9b-a1d3-4e6a8b0c2d5f",
          localVersion: "8",
          localDigest: digestB,
          createdAt: secondReceivedAt,
        }),
      ),
    ).toMatchObject({
      kind: "written",
      run: { id: "d8f0b2c4-5e7a-4f9b-a1d3-4e6a8b0c2d5f", status: "matched" },
    })
    // 作成を含むbatchが競合で失敗し、assertionを作らないbatchでやり直している。
    expect(racing.batchCalls()).toBe(2)

    expect(await assertionRows(fixture)).toMatchObject([
      {
        id: "3e5a7c9b-2d4f-4b6a-a8c0-1e3f5a7b9c2d",
        payload_digest: digestB,
        received_at: firstReceivedAt.getTime(),
      },
    ])
    expect(await runRows(fixture)).toEqual([
      {
        id: "c7e9a1b3-4d6f-4e8a-b0c2-3d5f7a9b1c4e",
        assertion_id: "3e5a7c9b-2d4f-4b6a-a8c0-1e3f5a7b9c2d",
        local_version: "7",
        status: "mismatched",
      },
      {
        id: "d8f0b2c4-5e7a-4f9b-a1d3-4e6a8b0c2d5f",
        assertion_id: "3e5a7c9b-2d4f-4b6a-a8c0-1e3f5a7b9c2d",
        local_version: "8",
        status: "matched",
      },
    ])
    expect(await totals(fixture)).toEqual({ assertions: 1, runs: 2, items: 2, audits: 0 })
  })

  test("初回の作成の競合で違う事実が先に保存された照合は拒否し、何も保存しない", async () => {
    const fixture = await createFixture()
    const competitor = new SystemReconciliationRepository(fixture.context)
    const racing = createRacingDatabase(fixture.database, async () => {
      expect(
        await competitor.write(
          createAssertion({ payloadDigest: digestA }),
          createRun({ localDigest: digestA, externalDigest: digestA }),
        ),
      ).toMatchObject({ kind: "written" })
    })
    const repository = new SystemReconciliationRepository({ env: { DB: racing.database } })
    const audit = createAuditEvent("d8f0b2c4-5e7a-4f9b-a1d3-4e6a8b0c2d5f")

    expect(
      await repository.write(
        createAssertion({}),
        createRun({
          id: "d8f0b2c4-5e7a-4f9b-a1d3-4e6a8b0c2d5f",
          localVersion: "8",
          localDigest: digestB,
        }),
        new SystemAuditEventRepository(fixture.context).prepareAppend(audit),
      ),
    ).toEqual({ kind: "conflict" })
    expect(racing.batchCalls()).toBe(1)

    expect(await assertionRows(fixture)).toMatchObject([
      { id: "3e5a7c9b-2d4f-4b6a-a8c0-1e3f5a7b9c2d", payload_digest: digestA },
    ])
    expect(await totals(fixture)).toEqual({ assertions: 1, runs: 1, items: 1, audits: 0 })
  })

  test("run・item・監査のどれかが保存できない照合は、assertionを含めて何も保存しない", async () => {
    const fixture = await createFixture()
    const repository = new SystemReconciliationRepository(fixture.context)
    const audits = new SystemAuditEventRepository(fixture.context)
    expect(
      await repository.write(
        createAssertion({}),
        createRun({ localDigest: digestA }),
        audits.prepareAppend(createAuditEvent("c7e9a1b3-4d6f-4e8a-b0c2-3d5f7a9b1c4e")),
      ),
    ).toMatchObject({ kind: "written" })
    const stored = await storedState(fixture)
    expect(stored.totals).toEqual({ assertions: 1, runs: 1, items: 1, audits: 1 })

    // 新しい外部の版のassertionと一緒に、保存済みのrunと同じidを渡す。
    expect(
      await repository.write(
        createAssertion({ id: "4f6b8d0c-3e5a-4c7b-b9d1-2f4a6b8c0d3e", externalVersion: "2" }),
        createRun({
          assertionId: "4f6b8d0c-3e5a-4c7b-b9d1-2f4a6b8c0d3e",
          localVersion: "8",
          localDigest: digestB,
        }),
        audits.prepareAppend(createAuditEvent("c7e9a1b3-4d6f-4e8a-b0c2-3d5f7a9b1c4e")),
      ),
    ).toEqual({ kind: "conflict" })
    expect(await storedState(fixture)).toEqual(stored)

    // 保存済みのassertionへ、同じローカルの版のrunを別のidで重ねる。
    expect(
      await repository.write(
        createAssertion({ receivedAt: secondReceivedAt }),
        createRun({ id: "d8f0b2c4-5e7a-4f9b-a1d3-4e6a8b0c2d5f", localDigest: digestB }),
        audits.prepareAppend(createAuditEvent("d8f0b2c4-5e7a-4f9b-a1d3-4e6a8b0c2d5f")),
      ),
    ).toEqual({ kind: "conflict" })
    expect(await storedState(fixture)).toEqual(stored)

    // 監査の追記だけが失敗する場合も、新しいassertion・run・itemを残さない。
    const recordedAudit = createAuditEvent("e9a1c3d5-6f8b-4a0c-b2e4-5f7b9c1d3e6a")
    expect(await audits.append(recordedAudit)).toBeUndefined()
    const storedWithAudit = await storedState(fixture)
    expect(
      await repository.write(
        createAssertion({ id: "5a7c9e1d-4f6b-4d8c-a0e2-3a5b7c9d1e4f", externalVersion: "3" }),
        createRun({
          id: "e9a1c3d5-6f8b-4a0c-b2e4-5f7b9c1d3e6a",
          assertionId: "5a7c9e1d-4f6b-4d8c-a0e2-3a5b7c9d1e4f",
          localVersion: "9",
          localDigest: digestB,
        }),
        audits.prepareAppend(recordedAudit),
      ),
    ).toEqual({ kind: "conflict" })
    expect(
      await repository.write(
        createAssertion({ receivedAt: secondReceivedAt }),
        createRun({
          id: "e9a1c3d5-6f8b-4a0c-b2e4-5f7b9c1d3e6a",
          localVersion: "9",
          localDigest: digestB,
        }),
        audits.prepareAppend(recordedAudit),
      ),
    ).toEqual({ kind: "conflict" })
    expect(await storedState(fixture)).toEqual(storedWithAudit)
  })
})

async function createFixture(): Promise<SystemSessionTestContext> {
  const fixture = await SystemSessionTestContext.create()
  await execSql(
    fixture.database,
    `INSERT INTO system_connectors
       (id, key, name, direction, transport, status, revision, created_at, updated_at)
     VALUES ('6f1c2a0e-5b7d-4c3a-9e21-8a4d0b6c7e15', 'generic', 'Generic', 'bidirectional', 'api', 'active', 1, 1, 1);
     INSERT INTO system_integration_exchanges
       (id, connector_id, direction, operation_key, idempotency_key, payload_digest, status,
        attempt, external_reference, last_error_code, created_at, updated_at, completed_at)
     VALUES ('b2d4f6a8-1c3e-4a5b-8c7d-9e0f1a2b3c4d', '6f1c2a0e-5b7d-4c3a-9e21-8a4d0b6c7e15', 'outbound', 'record.export', 'command:1',
             '${digestA}', 'pending', 1, NULL, NULL, 1, 1, NULL),
            ('a1c3e5b7-9d0f-4b2a-8c4e-6f8a0b2c4d6e', '6f1c2a0e-5b7d-4c3a-9e21-8a4d0b6c7e15', 'outbound', 'record.export', 'command:2',
             '${digestA}', 'pending', 1, NULL, NULL, 1, 1, NULL);`,
  )
  return fixture
}

type AssertionOverrides = Readonly<{
  id?: string
  exchangeId?: string
  externalKey?: string
  externalVersion?: string
  payloadDigest?: string
  observedAt?: Date
  receivedAt?: Date
}>

function createAssertion(overrides: AssertionOverrides): ExternalAssertionEntity {
  const assertion = ExternalAssertionEntity.create({
    id: overrides.id ?? "3e5a7c9b-2d4f-4b6a-a8c0-1e3f5a7b9c2d",
    connectorId: "6f1c2a0e-5b7d-4c3a-9e21-8a4d0b6c7e15",
    exchangeId: overrides.exchangeId ?? "b2d4f6a8-1c3e-4a5b-8c7d-9e0f1a2b3c4d",
    externalKey: overrides.externalKey ?? "record:1",
    externalVersion: overrides.externalVersion ?? "1",
    payloadDigest: overrides.payloadDigest ?? digestB,
    observedAt: overrides.observedAt ?? observedAt,
    receivedAt: overrides.receivedAt ?? firstReceivedAt,
  })
  if (assertion instanceof Error) throw assertion
  return assertion
}

type RunOverrides = Readonly<{
  id?: string
  exchangeId?: string
  assertionId?: string
  localVersion?: string
  localDigest: string
  externalDigest?: string
  createdAt?: Date
}>

function createRun(overrides: RunOverrides): ReconciliationRunEntity {
  const run = ReconciliationRunEntity.create({
    id: overrides.id ?? "c7e9a1b3-4d6f-4e8a-b0c2-3d5f7a9b1c4e",
    exchangeId: overrides.exchangeId ?? "b2d4f6a8-1c3e-4a5b-8c7d-9e0f1a2b3c4d",
    assertionId: overrides.assertionId ?? "3e5a7c9b-2d4f-4b6a-a8c0-1e3f5a7b9c2d",
    localVersion: overrides.localVersion ?? "7",
    createdAt: overrides.createdAt ?? firstReceivedAt,
    items: [
      {
        key: "record:1",
        localDigest: overrides.localDigest,
        externalDigest: overrides.externalDigest ?? digestB,
      },
    ],
  })
  if (run instanceof Error) throw run
  return run
}

function createAuditEvent(targetId: string): SystemAuditEventEntity {
  const event = SystemAuditEventEntity.create({
    actorAccountId: null,
    action: SYSTEM_AUDIT_ACTIONS.systemIntegrationReconciliationRecorded,
    targetType: "system:integration_reconciliation",
    targetId,
    outcome: "succeeded",
    reasonCode: null,
    authorizationJson: null,
    beforeJson: null,
    afterJson: null,
    metadataJson: null,
    occurredAt: firstReceivedAt,
  })
  if (event instanceof Error) throw event
  return event
}

/** 最初のbatchの直前に別の書き込みを割り込ませ、読み取りと書き込みの間の競合を再現する。 */
function createRacingDatabase(
  database: D1Database,
  beforeFirstBatch: () => Promise<void>,
): Readonly<{ database: D1Database; batchCalls: () => number }> {
  const state = { batchCalls: 0 }
  const racingDatabase = new Proxy(database, {
    get(target, property) {
      if (property === "batch") {
        return async (statements: D1PreparedStatement[]) => {
          state.batchCalls += 1
          if (state.batchCalls === 1) await beforeFirstBatch()
          return target.batch(statements)
        }
      }
      const member = Reflect.get(target, property, target)
      return typeof member === "function" ? member.bind(target) : member
    },
  })
  return { database: racingDatabase, batchCalls: () => state.batchCalls }
}

async function assertionRows(
  fixture: SystemSessionTestContext,
): Promise<ReadonlyArray<Record<string, unknown>>> {
  const rows = await fixture.database
    .prepare("SELECT * FROM system_external_assertions ORDER BY id")
    .all<Record<string, unknown>>()
  return rows.results
}

async function runRows(
  fixture: SystemSessionTestContext,
): Promise<ReadonlyArray<Record<string, unknown>>> {
  const rows = await fixture.database
    .prepare(
      "SELECT id, assertion_id, local_version, status FROM system_reconciliation_runs ORDER BY id",
    )
    .all<Record<string, unknown>>()
  return rows.results
}

async function totals(fixture: SystemSessionTestContext): Promise<Record<string, unknown> | null> {
  return fixture.database
    .prepare(
      `SELECT (SELECT count(*) FROM system_external_assertions) AS assertions,
              (SELECT count(*) FROM system_reconciliation_runs) AS runs,
              (SELECT count(*) FROM system_reconciliation_items) AS items,
              (SELECT count(*) FROM system_audit_events) AS audits`,
    )
    .first<Record<string, unknown>>()
}

async function storedState(fixture: SystemSessionTestContext) {
  return {
    assertions: await assertionRows(fixture),
    runs: await runRows(fixture),
    totals: await totals(fixture),
  }
}
