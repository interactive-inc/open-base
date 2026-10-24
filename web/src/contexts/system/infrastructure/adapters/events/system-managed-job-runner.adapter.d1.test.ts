import { execSql } from "@system/test/local-d1/exec-sql.test-support"
import { expect, setDefaultTimeout, test } from "bun:test"
import { readFileSync } from "node:fs"
import { createLocalD1Database } from "@system/test/local-d1/create-local-d1-database.test-support"
import { SystemManagedJobRunnerAdapter } from "@system/infrastructure/adapters/events/system-managed-job-runner.adapter"
import { SystemDeliveryRepository } from "@system/infrastructure/repositories/events/system-delivery.repository"
import { SystemDeliveryEntity } from "@system/domain/entities/system-delivery.entity"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

async function fixture(maxAttempts = 2) {
  const database = await createLocalD1Database({ schema: "" })
  for (const name of ["system-core", "system-integration", "system-principal", "system-delivery"])
    await execSql(
      database,
      readFileSync(new URL(`../../schema/${name}.sql`, import.meta.url), "utf8"),
    )
  await execSql(
    database,
    `INSERT INTO system_accounts (id,status,token_version,created_at,updated_at) VALUES ('75effc00-0878-4178-8d76-277086315849','active',0,0,0);
    INSERT INTO system_principals (id,account_id,kind,name,revision,created_at,updated_at) VALUES ('308954f7-a233-4860-85cb-026577024347','75effc00-0878-4178-8d76-277086315849','service','Worker',1,0,0);
    INSERT INTO system_iam_roles (id,key,kind,name,created_at,updated_at) VALUES ('4e74c1bb-6f90-452e-852b-b723b635cc75','worker','custom','Worker',0,0);
    INSERT INTO system_iam_role_permissions (role_id, permission_key) VALUES ('4e74c1bb-6f90-452e-852b-b723b635cc75','batch:execute');
    INSERT INTO system_role_bindings (id,account_id,role_id,created_at) VALUES ('d50d88aa-2e8e-4e9b-8d15-2a1fb3ed6a4c','75effc00-0878-4178-8d76-277086315849','4e74c1bb-6f90-452e-852b-b723b635cc75',0);
    CREATE TABLE effects (id TEXT PRIMARY KEY);`,
  )
  const clock = { at: new Date(1000) }
  const workerAccountId = zAccountId.parse("75effc00-0878-4178-8d76-277086315849")
  const jobInput = {
    id: "01900054-0000-7000-8000-000000000001",
    kind: "job",
    handlerKey: "example.record",
    operationKey: "example.record",
    payloadDigest: "a".repeat(64),
    idempotencyKey: "event:1",
    status: "queued",
    attempt: 0,
    maxAttempts,
    availableAt: clock.at,
    leaseAccountId: null,
    leaseTokenHash: null,
    leaseExpiresAt: null,
    lastErrorCode: null,
    createdAt: clock.at,
    updatedAt: clock.at,
    completedAt: null,
  }
  const queued = SystemDeliveryEntity.create(jobInput)
  if (queued instanceof Error) throw queued
  const repository = new SystemDeliveryRepository({ env: { DB: database } })
  expect(await repository.create(queued, workerAccountId, null, [])).toBe("created")
  const run = (
    prepare: (
      job: SystemDeliveryEntity,
      at: Date,
    ) => Promise<ReadonlyArray<D1PreparedStatement> | Error> = async (job) => [
      database.prepare("INSERT INTO effects VALUES (?1)").bind(job.id),
    ],
  ) =>
    new SystemManagedJobRunnerAdapter({
      env: { DB: database },
      workerAccountId,
      handlerKey: "example.record",
      clock: () => clock.at,
      prepare,
    }).run(10)
  return { database, clock, jobInput, queued, repository, workerAccountId, run }
}

test("並行Workerでも業務とjobの完了を一回だけ保存する", async () => {
  const c = await fixture()
  const outcomes = await Promise.all([c.run(), c.run()])
  expect(outcomes.flat()).toEqual(
    expect.arrayContaining([{ id: "01900054-0000-7000-8000-000000000001", status: "succeeded" }]),
  )
  expect((await c.database.prepare("SELECT * FROM effects").all()).results).toEqual([
    { id: "01900054-0000-7000-8000-000000000001" },
  ])
  expect(await c.repository.find("job", "01900054-0000-7000-8000-000000000001")).toMatchObject({
    status: "succeeded",
    handlerKey: "example.record",
  })
  expect(await c.run()).toEqual([])
})

test("業務または監査の保存失敗を再試行へ戻し、上限後にdead letterへ残す", async () => {
  const c = await fixture()
  await execSql(
    c.database,
    "CREATE TRIGGER audit_failure BEFORE INSERT ON system_audit_events WHEN NEW.action = 'system.managed_job.succeeded' BEGIN SELECT RAISE(ABORT, 'audit unavailable'); END",
  )
  expect(await c.run()).toEqual([{ id: "01900054-0000-7000-8000-000000000001", status: "queued" }])
  expect((await c.database.prepare("SELECT * FROM effects").all()).results).toEqual([])
  expect(await c.run()).toEqual([])
  c.clock.at = new Date(11_000)
  expect(await c.run()).toEqual([
    { id: "01900054-0000-7000-8000-000000000001", status: "dead_letter" },
  ])
  expect(await c.repository.findDeadLetters()).toMatchObject([
    { sourceId: "01900054-0000-7000-8000-000000000001", attempt: 2, reasonCode: "handler.failed" },
  ])
})

test("失敗の原因を解消すると、同じjobと冪等性キーで業務を完了できる", async () => {
  const c = await fixture()
  expect(await c.run(async () => new Error("unavailable"))).toEqual([
    { id: "01900054-0000-7000-8000-000000000001", status: "queued" },
  ])
  c.clock.at = new Date(11_000)
  expect(await c.run()).toEqual([
    { id: "01900054-0000-7000-8000-000000000001", status: "succeeded" },
  ])
  expect(await c.repository.find("job", "01900054-0000-7000-8000-000000000001")).toMatchObject({
    attempt: 2,
    idempotencyKey: "event:1",
  })
})

test("準備中の権限失効とlease期限切れでは業務を保存しない", async () => {
  for (const kind of ["revoke", "expire"] as const) {
    const c = await fixture(1)
    const outcome = await c.run(async () => {
      if (kind === "revoke")
        await execSql(c.database, "UPDATE system_role_bindings SET revoked_at = 1000")
      else c.clock.at = new Date(61_000)
      return [c.database.prepare("INSERT INTO effects VALUES ('effect')")]
    })
    expect(outcome).toBeInstanceOf(Error)
    expect((await c.database.prepare("SELECT * FROM effects").all()).results).toEqual([])
    expect(await c.repository.find("job", "01900054-0000-7000-8000-000000000001")).toMatchObject({
      status: "leased",
    })
    if (kind === "expire")
      expect(await c.run()).toEqual([
        { id: "01900054-0000-7000-8000-000000000001", status: "dead_letter" },
      ])
  }
})

test("人とAgentは登録処理のServiceを代替できない", async () => {
  for (const kind of ["human", "agent"] as const) {
    const c = await fixture()
    await c.database
      .prepare("UPDATE system_principals SET kind = ?1, revision = 2")
      .bind(kind)
      .run()
    expect(await c.run()).toBeInstanceOf(Error)
    expect(await c.repository.find("job", "01900054-0000-7000-8000-000000000001")).toMatchObject({
      status: "queued",
      attempt: 0,
    })
  }
})

test("同時刻のheartbeat後に古いlease状態で成功を書き込めない", async () => {
  const c = await fixture()
  const leased = c.queued.claim(c.workerAccountId, "b".repeat(64), c.clock.at, 10_000)
  if (leased instanceof Error) throw leased
  expect(await c.repository.update(c.queued, leased, [])).toBe("updated")
  const heartbeat = leased.heartbeat(c.workerAccountId, "b".repeat(64), c.clock.at, 20_000)
  const staleCompletion = leased.succeed(c.workerAccountId, "b".repeat(64), c.clock.at)
  if (heartbeat instanceof Error || staleCompletion instanceof Error)
    throw new Error("invalid test lease")
  expect(await c.repository.update(leased, heartbeat, [])).toBe("updated")
  expect(await c.repository.update(leased, staleCompletion, [])).toBe("conflict")
})

test("別の登録処理・未登録job・将来のjobは実行しない", async () => {
  const c = await fixture()
  for (const handlerKey of ["example.other", null, "example.record"]) {
    const job = SystemDeliveryEntity.create({
      ...c.jobInput,
      id: {
        "example.other": "01900054-0000-7000-8000-000000000011",
        unbound: "01900054-0000-7000-8000-000000000012",
        "example.record": "01900054-0000-7000-8000-000000000013",
      }[handlerKey ?? "unbound"],
      idempotencyKey: `event:${handlerKey ?? "unbound"}`,
      handlerKey,
      availableAt: new Date(2000),
    })
    if (job instanceof Error) throw job
    expect(await c.repository.create(job, c.workerAccountId, null, [])).toBe("created")
  }
  expect(await c.run()).toEqual([
    { id: "01900054-0000-7000-8000-000000000001", status: "succeeded" },
  ])
  c.clock.at = new Date(2000)
  expect(await c.run()).toEqual([
    { id: "01900054-0000-7000-8000-000000000013", status: "succeeded" },
  ])
  expect(
    await c.database
      .prepare("SELECT count(*) AS total FROM effects")
      .first<Record<string, unknown>>(),
  ).toEqual({ total: 2 })
})

test("業務の途中保存が失敗すると、先行保存とjob完了も取り消す", async () => {
  const c = await fixture()
  expect(
    await c.run(async () => [
      c.database.prepare("INSERT INTO effects VALUES ('effect:1')"),
      c.database.prepare("INSERT INTO effects VALUES ('effect:1')"),
    ]),
  ).toEqual([{ id: "01900054-0000-7000-8000-000000000001", status: "queued" }])
  expect((await c.database.prepare("SELECT * FROM effects").all()).results).toEqual([])
  expect(await c.repository.find("job", "01900054-0000-7000-8000-000000000001")).toMatchObject({
    status: "queued",
    attempt: 1,
  })
})

test("dead letterの再投入でも登録処理と操作を保持し、別handlerへ付け替えない", async () => {
  const c = await fixture(1)
  expect(await c.run(async () => new Error("retry needed"))).toEqual([
    { id: "01900054-0000-7000-8000-000000000001", status: "dead_letter" },
  ])
  const letters = await c.repository.findDeadLetters()
  if (letters instanceof Error || letters[0] === undefined) throw new Error("missing dead letter")
  const id = letters[0].id
  for (const variant of ["unbound", "other_operation", "retained"]) {
    const job = SystemDeliveryEntity.create({
      ...c.jobInput,
      id: {
        unbound: "01900054-0000-7000-8000-000000000021",
        other_operation: "01900054-0000-7000-8000-000000000022",
        retained: "01900054-0000-7000-8000-000000000023",
      }[variant],
      idempotencyKey: `dead-letter:${id}`,
      handlerKey: variant === "unbound" ? null : c.queued.handlerKey,
      operationKey: variant === "other_operation" ? "example.other" : c.queued.operationKey,
    })
    if (job instanceof Error) throw job
    const saved = await c.repository.requeueDeadLetter(id, job, c.workerAccountId, [])
    if (variant !== "retained") expect(saved).toBe("conflict")
    else expect(saved).toEqual({ status: "created", jobId: job.id })
  }
  expect(await c.run()).toEqual([
    { id: "01900054-0000-7000-8000-000000000023", status: "succeeded" },
  ])
})
