import { UpdateIntegrationExchange } from "@system/application/integration/update-integration-exchange"
import { SYSTEM_AUDIT_ACTIONS } from "@system/domain/catalogs/audit/system-audit-action.catalog"
import { IntegrationExchangeEntity } from "@system/domain/entities/integration-exchange.entity"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { SystemAuditEventRepository } from "@system/infrastructure/repositories/audit/system-audit-event.repository"
import { SystemIntegrationExchangeRepository } from "@system/infrastructure/repositories/integration/system-integration-exchange.repository"
import { SystemSessionTestContext } from "@system/test/system-session-test-context.test-support"
import { describe, expect, test } from "bun:test"

const exchangeId = "b2d4f6a8-1c3e-4a5b-8c7d-9e0f1a2b3c4d"
const connectorId = "6f1c2a0e-5b7d-4c3a-9e21-8a4d0b6c7e15"
const updatedAt = new Date("2026-01-01T00:00:00.000Z")
const terminalStatuses: IntegrationExchangeEntity["status"][] = ["succeeded", "cancelled"]

describe("外部交換のsnapshotによる楽観ロック", () => {
  test.each(terminalStatuses)(
    "%sの同一ミリ秒での保存後は古いpendingからの更新と監査を拒否する",
    async (status) => {
      const fixture = await createFixture()
      const repository = new SystemIntegrationExchangeRepository(fixture.context)
      const first = await findExchange(repository)
      const stale = await findExchange(repository)

      expect(await updateFromSnapshot(fixture, first, { status, at: updatedAt })).toMatchObject({
        kind: "written",
        exchange: { status },
      })
      const stored = await storedState(fixture)
      expect(await updateFromSnapshot(fixture, stale, { status: "failed", at: updatedAt })).toEqual(
        {
          kind: "conflict",
        },
      )
      expect(await storedState(fixture)).toEqual(stored)
      expect((await findExchange(repository)).updatedAt).toEqual(updatedAt)
      expect(stored.audits).toHaveLength(1)
    },
  )

  test("同一ミリ秒のfailedからretryしてpendingに戻っても古い試行のsnapshotを拒否する", async () => {
    const fixture = await createFixture()
    const repository = new SystemIntegrationExchangeRepository(fixture.context)
    const pending = await findExchange(repository)
    expect(
      await updateFromSnapshot(fixture, pending, { status: "failed", at: updatedAt }),
    ).toMatchObject({ kind: "written" })
    const failed = await findExchange(repository)

    expect(
      await updateFromSnapshot(fixture, failed, { status: "pending", at: updatedAt }),
    ).toMatchObject({ kind: "written", exchange: { status: "pending", attempt: 2 } })
    const retriedState = await storedState(fixture)
    expect(
      await updateFromSnapshot(fixture, pending, { status: "succeeded", at: updatedAt }),
    ).toEqual({ kind: "conflict" })
    expect(await updateFromSnapshot(fixture, failed, { status: "pending", at: updatedAt })).toEqual(
      { kind: "conflict" },
    )
    expect(await storedState(fixture)).toEqual(retriedState)

    const retried = await findExchange(repository)
    expect(
      await updateFromSnapshot(fixture, retried, { status: "succeeded", at: updatedAt }),
    ).toMatchObject({ kind: "written", exchange: { status: "succeeded", attempt: 2 } })
    expect((await storedState(fixture)).audits).toHaveLength(3)
  })

  test("異なる更新日時の競合でも最初の更新と監査だけを残す", async () => {
    const fixture = await createFixture()
    const repository = new SystemIntegrationExchangeRepository(fixture.context)
    const pending = await findExchange(repository)
    const firstUpdateAt = new Date(updatedAt.getTime() + 1)
    const staleUpdateAt = new Date(updatedAt.getTime() + 2)

    expect(
      await updateFromSnapshot(fixture, pending, { status: "failed", at: firstUpdateAt }),
    ).toMatchObject({ kind: "written" })
    const stored = await storedState(fixture)
    expect(
      await updateFromSnapshot(fixture, pending, { status: "succeeded", at: staleUpdateAt }),
    ).toEqual({ kind: "conflict" })
    expect(await storedState(fixture)).toEqual(stored)
    expect((await findExchange(repository)).updatedAt).toEqual(firstUpdateAt)
    expect(stored.audits).toHaveLength(1)
  })

  test("監査の保存失敗時は同じbatchの交換更新も取り消す", async () => {
    const fixture = await createFixture()
    const repository = new SystemIntegrationExchangeRepository(fixture.context)
    const pending = await findExchange(repository)
    const event = createAuditEvent({ status: "succeeded", at: updatedAt })
    const auditStatements = new SystemAuditEventRepository(fixture.context).prepareAppend(event)
    await fixture.database.batch([...auditStatements])
    const stored = await storedState(fixture)
    const succeeded = pending.transition("succeeded", updatedAt, {
      externalReference: null,
      errorCode: null,
    })
    if (succeeded instanceof Error) throw succeeded

    expect(await repository.write(succeeded, pending, auditStatements)).toMatchObject({
      kind: "unavailable",
    })
    expect(await storedState(fixture)).toEqual(stored)
  })
})

async function createFixture(): Promise<SystemSessionTestContext> {
  const fixture = await SystemSessionTestContext.create()
  await fixture.database
    .prepare(`INSERT INTO system_connectors
       (id, key, name, direction, transport, status, revision, created_at, updated_at)
       VALUES (?1, 'generic', 'Generic', 'bidirectional', 'api', 'active', 1, ?2, ?2)`)
    .bind(connectorId, updatedAt.getTime())
    .run()
  const pending = IntegrationExchangeEntity.create({
    id: exchangeId,
    connectorId,
    direction: "outbound",
    operationKey: "record.export",
    idempotencyKey: "command:1",
    payloadDigest: "a".repeat(64),
    status: "pending",
    attempt: 1,
    externalReference: null,
    lastErrorCode: null,
    createdAt: updatedAt,
    updatedAt,
    completedAt: null,
  })
  if (pending instanceof Error) throw pending
  expect(
    await new SystemIntegrationExchangeRepository(fixture.context).write(pending, null),
  ).toMatchObject({
    kind: "written",
  })
  return fixture
}

async function findExchange(
  repository: SystemIntegrationExchangeRepository,
): Promise<IntegrationExchangeEntity> {
  const exchange = await repository.find(exchangeId)
  if (exchange === null) throw new Error("exchange not found")
  if (exchange instanceof Error) throw exchange
  return exchange
}

type Transition = Readonly<{ status: IntegrationExchangeEntity["status"]; at: Date }>

function updateFromSnapshot(
  fixture: SystemSessionTestContext,
  snapshot: IntegrationExchangeEntity,
  transition: Transition,
) {
  const repository = new SystemIntegrationExchangeRepository(fixture.context)
  const event = createAuditEvent(transition)
  const auditStatements = new SystemAuditEventRepository(fixture.context).prepareAppend(event)
  const service = new UpdateIntegrationExchange({
    find: () => Promise.resolve(snapshot),
    write: (exchange, expectedExchange) =>
      repository.write(exchange, expectedExchange, auditStatements),
  })
  return service.execute({
    id: exchangeId,
    status: transition.status,
    at: transition.at,
    externalReference: null,
    errorCode: transition.status === "failed" ? "remote.failed" : null,
  })
}

function createAuditEvent(transition: Transition): SystemAuditEventEntity {
  const actions = {
    pending: SYSTEM_AUDIT_ACTIONS.systemIntegrationExchangePending,
    succeeded: SYSTEM_AUDIT_ACTIONS.systemIntegrationExchangeSucceeded,
    failed: SYSTEM_AUDIT_ACTIONS.systemIntegrationExchangeFailed,
    cancelled: SYSTEM_AUDIT_ACTIONS.systemIntegrationExchangeCancelled,
  }
  const event = SystemAuditEventEntity.create({
    actorAccountId: null,
    action: actions[transition.status],
    targetType: "system:integration_exchange",
    targetId: exchangeId,
    outcome: "succeeded",
    reasonCode: null,
    authorizationJson: null,
    beforeJson: null,
    afterJson: null,
    metadataJson: null,
    occurredAt: transition.at,
  })
  if (event instanceof Error) throw event
  return event
}

async function storedState(fixture: SystemSessionTestContext) {
  const exchange = await fixture.database
    .prepare("SELECT * FROM system_integration_exchanges WHERE id = ?1")
    .bind(exchangeId)
    .first<Record<string, unknown>>()
  const audits = await fixture.database
    .prepare("SELECT * FROM system_audit_events WHERE target_id = ?1 ORDER BY event_id")
    .bind(exchangeId)
    .all<Record<string, unknown>>()
  return { exchange, audits: audits.results }
}
