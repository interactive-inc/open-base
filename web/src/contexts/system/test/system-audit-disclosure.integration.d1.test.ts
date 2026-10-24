import { testDerivedId } from "@system/test/system-test-id.test-support"
import { expect, setDefaultTimeout, spyOn, test } from "bun:test"
import { drizzle } from "drizzle-orm/d1"
import { createSystemAttachmentTestDatabase } from "@system/test/create-system-attachment-test-database.test-support"
import { createSystemSessionApplications } from "@system/test/create-system-session-applications.test-support"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { SystemPrincipalSecretService } from "@system/lib/auth/system-principal-secret-service"
import { systemFactory } from "@system/interface/request-environment/system-factory"
import {
  GET as READ_POLICY,
  POST as PUBLISH,
} from "@system/interface/routes/system.audit-disclosure-policies"
import { GET as LIST } from "@system/interface/routes/system.audit-events"
import { GET as DETAIL } from "@system/interface/routes/system.audit-events.$eventId"
import { SystemAuditEventQueryAdapter } from "@system/infrastructure/adapters/audit/system-audit-event-query.adapter"
import { SystemAuditDisclosurePolicyRepository } from "@system/infrastructure/repositories/audit/system-audit-disclosure-policy.repository"
import { SystemAuditDisclosureReadAdapter } from "@system/infrastructure/adapters/audit/system-audit-disclosure-read.adapter"
import {
  auditDisclosurePolicyResponseSchema,
  auditDisclosureCurrentPolicyResponseSchema,
} from "@system/interface/http/audit-disclosure-response-schemas"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

const at = new Date("2026-08-21T09:00:00.000Z")
const eventId = "00000000-0000-4000-8000-000000000010"
/** role と割当の主キーは UUID のため、操作者ごとに決まった値を使う。 */
const roleIds: Record<string, string> = {}
const bindingIds: Record<string, string> = {}
function roleIdOf(id: string): string {
  return (roleIds[id] ??= crypto.randomUUID())
}
function bindingIdOf(id: string): string {
  return (bindingIds[id] ??= crypto.randomUUID())
}

async function fixture() {
  const db = await createSystemAttachmentTestDatabase()
  const database = drizzle(db)
  const clock = { now: at }
  for (const id of [
    "282b84eb-787d-4655-a88b-c072960fc970",
    "f43d89f4-ac52-411f-828b-78838556ce92",
    "28689052-c77f-42e5-8f85-1b461d9f5514",
  ]) {
    await db
      .prepare(
        "INSERT INTO system_accounts (id, status, token_version, created_at, updated_at) VALUES (?1, 'active', 0, 100, 100)",
      )
      .bind(id)
      .run()
    await db
      .prepare(
        "INSERT INTO system_principals (id, account_id, kind, name, revision, created_at, updated_at) VALUES (?1, ?2, 'human', 'Test operator', 1, 100, 100)",
      )
      .bind(testDerivedId("principal", id), id)
      .run()
    await db
      .prepare(
        "INSERT INTO system_iam_roles (id, key, kind, name, created_at, updated_at) VALUES (?1, ?2, 'custom', 'Test role', 100, 100)",
      )
      .bind(roleIdOf(id), `role:${id}`)
      .run()
    await db
      .prepare("INSERT INTO system_iam_role_permissions (role_id, permission_key) VALUES (?1, ?2)")
      .bind(
        roleIdOf(id),
        id === "282b84eb-787d-4655-a88b-c072960fc970" ? "system:admin" : "audit:read",
      )
      .run()
    await db
      .prepare(
        "INSERT INTO system_role_bindings (id, account_id, role_id, created_at) VALUES (?1, ?2, ?3, 100)",
      )
      .bind(bindingIdOf(id), id, roleIdOf(id))
      .run()
  }
  await db
    .prepare(`INSERT INTO system_audit_events (event_id, actor_account_id, action, target_type, target_id, outcome, reason_code, authorization_json, before_json, after_json, metadata_json, occurred_at)
    VALUES (?1, '28689052-c77f-42e5-8f85-1b461d9f5514', 'records.updated', 'records:entry', 'private-target', 'succeeded', 'private-reason', '{"role":"private-role"}', '{"value":"private-before"}', '{"value":"private-after"}', '{"value":"private-metadata"}', 1000)`)
    .bind(eventId)
    .run()
  const app = systemFactory
    .createApp()
    .use("*", async (context, next) => {
      context.set("now", () => clock.now)
      context.set("database", database)
      await next()
    })
    .get("/system/audit-disclosure-policies", ...READ_POLICY)
    .post("/system/audit-disclosure-policies", ...PUBLISH)
    .get("/system/audit-events", ...LIST)
    .get("/system/audit-events/:eventId", ...DETAIL)
  const jwtSecret = "audit-disclosure-test-jwt-secret"
  const applications = createSystemSessionApplications({
    context: { env: { DB: db } },
    jwtSecret,
    sessionTtlMilliseconds: 604_800_000,
  })
  if (applications instanceof Error) throw applications
  const sessions = applications
  async function headers(id: string) {
    const session = await sessions.issue.execute({
      accountId: zAccountId.parse(id),
      tokenVersion: 0,
      now: new Date(),
      auditContext: { authorizationJson: null, metadataJson: null },
    })
    if (session instanceof Error || session.kind === "rejected")
      throw new Error("session issuance failed")
    const raw = `${crypto.randomUUID()}${crypto.randomUUID()}`.replaceAll("-", "")
    const hash = await new SystemPrincipalSecretService().hashRawSecret(raw)
    if (hash instanceof Error) throw hash
    await db
      .prepare(
        "INSERT INTO system_step_up_grants (id, account_id, token_hash, method, issued_at, expires_at) VALUES (?1, ?2, ?3, 'password', ?4, ?5)",
      )
      .bind(crypto.randomUUID(), id, hash, at.getTime(), at.getTime() + 300000)
      .run()
    return {
      authorization: `Bearer ${session.accessToken}`,
      "x-system-step-up": raw,
      "content-type": "application/json",
    }
  }
  const admin = await headers("282b84eb-787d-4655-a88b-c072960fc970"),
    reader = await headers("f43d89f4-ac52-411f-828b-78838556ce92"),
    other = await headers("28689052-c77f-42e5-8f85-1b461d9f5514")
  const request = (path: string, init: RequestInit = {}) =>
    app.request(path, init, { DB: db, JWT_SECRET: jwtSecret })
  const command = {
    scope: "f43d89f4-ac52-411f-828b-78838556ce92",
    commandId: crypto.randomUUID(),
    expectedRevision: 0,
    enabled: true,
    allowedFields: [],
    allowedTargetTypes: ["records:entry"],
    allowedPurposes: ["review"],
    expiresAt: null,
    reason: "必要な情報に限定する",
  }
  const publish = (input: unknown = command, actor = admin) =>
    request("/system/audit-disclosure-policies", {
      method: "POST",
      headers: actor,
      body: JSON.stringify(input),
    })
  const read = (query = "", actor = reader) =>
    request(`/system/audit-events?action=records.updated${query}`, { headers: actor })
  return { db, clock, admin, reader, other, command, request, publish, read }
}

test.each([false, true])(
  "依頼照会後の保存を再送なら受理し、同じキーで内容変更なら拒否する（内容変更: %s）",
  async (changed) => {
    const f = await fixture()
    const readCurrent = SystemAuditDisclosurePolicyRepository.prototype.findCurrent
    let entered!: () => void
    let release!: () => void
    const waiting = new Promise<void>((resolve) => {
      entered = resolve
    })
    const resume = new Promise<void>((resolve) => {
      release = resolve
    })
    let first = true
    const current = spyOn(
      SystemAuditDisclosurePolicyRepository.prototype,
      "findCurrent",
    ).mockImplementation(async function (
      this: SystemAuditDisclosurePolicyRepository,
      scope: string,
    ) {
      if (first) {
        first = false
        entered()
        await resume
      }
      return readCurrent.call(this, scope)
    })
    let delayed: ReturnType<typeof f.publish> | undefined
    try {
      delayed = f.publish(changed ? { ...f.command, enabled: false } : f.command)
      await waiting
      expect((await f.publish()).status).toBe(201)
      release()
      expect((await delayed).status).toBe(changed ? 409 : 200)
      expect(
        await f.db
          .prepare("SELECT count(*) AS count FROM system_audit_disclosure_policy_revisions")
          .first<number>("count"),
      ).toBe(1)
    } finally {
      release()
      await delayed
      current.mockRestore()
    }
  },
)

test("同じ依頼の同時送信は一度だけ保存し、同じ版への別依頼は競合する", async () => {
  const f = await fixture()
  const same = await Promise.all([f.publish(), f.publish()])
  expect(same.map((response) => response.status).toSorted((left, right) => left - right)).toEqual([
    200, 201,
  ])
  const base = { ...f.command, expectedRevision: 1, enabled: false }
  const different = await Promise.all([
    f.publish({ ...base, commandId: crypto.randomUUID() }),
    f.publish({ ...base, commandId: crypto.randomUUID() }),
  ])
  expect(
    different.map((response) => response.status).toSorted((left, right) => left - right),
  ).toEqual([201, 409])
  expect(
    await f.db
      .prepare("SELECT count(*) AS count FROM system_audit_disclosure_policy_revisions")
      .first<{ count: number }>(),
  ).toEqual({ count: 2 })
})

test("人の管理資格・再認証と期待版を検査し、再送は一つの設定・監査に収束する", async () => {
  const f = await fixture()
  const absent = await f.request(
    "/system/audit-disclosure-policies?scope=f43d89f4-ac52-411f-828b-78838556ce92",
    {
      headers: f.admin,
    },
  )
  expect(absent.status).toBe(200)
  expect(auditDisclosureCurrentPolicyResponseSchema.parse(await absent.json())).toEqual({
    policy: null,
  })
  expect(
    (
      await f.request(
        "/system/audit-disclosure-policies?scope=f43d89f4-ac52-411f-828b-78838556ce92",
        { headers: f.reader },
      )
    ).status,
  ).toBe(403)
  expect((await f.publish(f.command, f.reader)).status).toBe(403)
  expect((await f.publish(f.command, { ...f.admin, "x-system-step-up": "" })).status).toBe(403)
  const created = await f.publish()
  expect(created.status).toBe(201)
  const initial = auditDisclosurePolicyResponseSchema.parse(await created.json())
  const current = await f.request(
    "/system/audit-disclosure-policies?scope=f43d89f4-ac52-411f-828b-78838556ce92",
    {
      headers: f.admin,
    },
  )
  expect(auditDisclosureCurrentPolicyResponseSchema.parse(await current.json())).toEqual({
    policy: initial.policy,
  })
  expect((await f.publish()).status).toBe(200)
  expect((await f.publish({ ...f.command, reason: "異なる依頼" })).status).toBe(409)
  expect((await f.publish({ ...f.command, commandId: crypto.randomUUID() })).status).toBe(409)
  const disabled = await f.publish({
    ...f.command,
    commandId: crypto.randomUUID(),
    expectedRevision: 1,
    enabled: false,
  })
  expect(disabled.status).toBe(201)
  const second = auditDisclosurePolicyResponseSchema.parse(await disabled.json())
  const audit = await f.db
    .prepare("SELECT before_json FROM system_audit_events WHERE event_id = ?1")
    .bind(second.policy.auditEventId)
    .first<{ before_json: string }>()
  expect(JSON.parse(audit?.before_json ?? "null")).toEqual(initial.policy)
  const replayed = auditDisclosurePolicyResponseSchema.parse(await (await f.publish()).json())
  expect(replayed.policy.revision).toBe(1)
  expect(
    await f.db
      .prepare("SELECT count(*) AS count FROM system_audit_disclosure_policy_revisions")
      .first<{ count: number }>(),
  ).toEqual({ count: 2 })
  await f.db
    .prepare("UPDATE system_role_bindings SET revoked_at = ?1 WHERE id = ?2")
    .bind(at.getTime(), bindingIdOf("282b84eb-787d-4655-a88b-c072960fc970"))
    .run()
  expect((await f.publish()).status).toBe(403)
})

test("一覧・詳細・検索件数へ開示制御を適用し、目的省略と期限切れを拒否する", async () => {
  const f = await fixture()
  expect(
    (await f.publish({ ...f.command, expiresAt: new Date(at.getTime() + 1000).toISOString() }))
      .status,
  ).toBe(201)
  expect((await f.read()).status).toBe(403)
  expect((await f.read("&purpose=other")).status).toBe(403)
  const response = await f.read("&purpose=review")
  expect(response.status).toBe(200)
  expect(response.headers.get("cache-control")).toBe("no-store")
  const body = await response.json()
  expect(body).toMatchObject({
    total: 1,
    events: [
      {
        actor_account_id: null,
        target_id: null,
        reason_code: null,
        authorization_json: null,
        before_json: null,
        after_json: null,
        metadata_json: null,
      },
    ],
  })
  expect(JSON.stringify(body)).not.toContain("private-")
  for (const query of [
    "&actor_account_id=other",
    "&target_id=private-target",
    "&target_type=system:session",
  ])
    expect(await (await f.read(`&purpose=review${query}`)).json()).toMatchObject({
      total: 0,
      events: [],
    })
  const detail = await f.request(`/system/audit-events/${eventId}?purpose=review`, {
    headers: f.reader,
  })
  expect(detail.status).toBe(200)
  expect(await detail.json()).toMatchObject({ actor_account_id: null, metadata_json: null })
  const other = await f.read("", f.other)
  expect(await other.json()).toMatchObject({
    events: [
      { actor_account_id: "28689052-c77f-42e5-8f85-1b461d9f5514", target_id: "private-target" },
    ],
  })
  f.clock.now = new Date(at.getTime() + 1000)
  expect((await f.read("&purpose=review")).status).toBe(403)
})

test("全体の制限はAccountの設定で広げられず、対象外の詳細を返さない", async () => {
  const f = await fixture()
  expect(
    (
      await f.publish({
        ...f.command,
        scope: "*",
        allowedFields: [],
        allowedPurposes: null,
        allowedTargetTypes: [],
      })
    ).status,
  ).toBe(201)
  expect(
    (await f.publish({ ...f.command, commandId: crypto.randomUUID(), enabled: false })).status,
  ).toBe(201)
  expect(await (await f.read()).json()).toMatchObject({ total: 0, events: [] })
  expect((await f.request(`/system/audit-events/${eventId}`, { headers: f.reader })).status).toBe(
    404,
  )
})

test("読取後の設定変更では成功監査も応答本文も返さない", async () => {
  const f = await fixture()
  const adapter = new SystemAuditEventQueryAdapter({ env: { DB: f.db } })
  const original = adapter.list.bind(adapter)
  const spy = spyOn(SystemAuditEventQueryAdapter.prototype, "list").mockImplementation(
    async function (this: SystemAuditEventQueryAdapter, ...args) {
      const result = await original.apply(this, args)
      expect((await f.publish()).status).toBe(201)
      return result
    },
  )
  try {
    const response = await f.read()
    expect(response.status).toBe(503)
    expect(await response.text()).not.toContain("private-")
    expect(
      await f.db
        .prepare(
          "SELECT count(*) AS count FROM system_audit_events WHERE action = 'system.audit.list' AND outcome = 'succeeded'",
        )
        .first<{ count: number }>(),
    ).toEqual({ count: 0 })
  } finally {
    spy.mockRestore()
  }
})

test("読取資格のsnapshotは付与元・Account変更をtransactionで再検査する", async () => {
  const f = await fixture()
  const proof = await new SystemAuditDisclosureReadAdapter({ env: { DB: f.db } }).prepare({
    accountId: "f43d89f4-ac52-411f-828b-78838556ce92",
    tokenVersion: 0,
    permission: "audit:read",
    purpose: null,
    now: at,
  })
  if (proof instanceof Error) throw proof
  await f.db
    .prepare("DELETE FROM system_iam_role_permissions WHERE role_id = ?1")
    .bind(roleIdOf("f43d89f4-ac52-411f-828b-78838556ce92"))
    .run()
  const page = await new SystemAuditEventQueryAdapter({ env: { DB: f.db } }).findById(
    eventId,
    proof,
  )
  expect(page).toBeInstanceOf(Error)
})

test("監査または設定の保存失敗は全取消し、同じ依頼で再試行できる", async () => {
  const f = await fixture()
  await f.db
    .prepare(
      "CREATE TRIGGER test_disclosure_failure BEFORE INSERT ON system_audit_disclosure_policy_revisions BEGIN SELECT RAISE(ABORT, 'injected failure'); END",
    )
    .run()
  expect((await f.publish()).status).toBe(503)
  expect(
    await f.db
      .prepare(
        "SELECT count(*) AS count FROM system_audit_events WHERE action = 'system.audit.disclosure.published'",
      )
      .first<{ count: number }>(),
  ).toEqual({ count: 0 })
  await f.db.prepare("DROP TRIGGER test_disclosure_failure").run()
  expect((await f.publish()).status).toBe(201)
  for (const query of [
    "UPDATE system_audit_disclosure_policy_revisions SET enabled = 0",
    "DELETE FROM system_audit_disclosure_policy_revisions",
  ])
    expect(
      await f.db
        .prepare(query)
        .run()
        .then(
          () => null,
          (error: unknown) => error,
        ),
    ).toBeInstanceOf(Error)
})

test("保存前に管理資格が失効した場合は再送を含めて拒否する", async () => {
  const f = await fixture()
  // oxlint-disable-next-line typescript/unbound-method -- apply below preserves the repository with its authorization assertions.
  const original = SystemAuditDisclosurePolicyRepository.prototype.append
  const spy = spyOn(SystemAuditDisclosurePolicyRepository.prototype, "append").mockImplementation(
    async function (this: SystemAuditDisclosurePolicyRepository, ...args) {
      await f.db
        .prepare(
          "UPDATE system_accounts SET token_version = 1, updated_at = ?1 WHERE id = '282b84eb-787d-4655-a88b-c072960fc970'",
        )
        .bind(at.getTime())
        .run()
      return original.apply(this, args)
    },
  )
  try {
    expect((await f.publish()).status).toBe(403)
  } finally {
    spy.mockRestore()
  }
  expect(
    await f.db
      .prepare("SELECT count(*) AS count FROM system_audit_disclosure_policy_revisions")
      .first<{ count: number }>(),
  ).toEqual({ count: 0 })
})

test("設定のINSERTが無変更でも成功とせず、監査だけの保存を取り消す", async () => {
  const f = await fixture()
  await f.db
    .prepare(
      "CREATE TRIGGER test_disclosure_ignore BEFORE INSERT ON system_audit_disclosure_policy_revisions BEGIN SELECT RAISE(IGNORE); END",
    )
    .run()
  expect((await f.publish()).status).toBe(503)
  expect(
    await f.db
      .prepare(
        "SELECT count(*) AS count FROM system_audit_events WHERE action = 'system.audit.disclosure.published'",
      )
      .first<{ count: number }>(),
  ).toEqual({ count: 0 })
  await f.db.prepare("DROP TRIGGER test_disclosure_ignore").run()
  expect((await f.publish()).status).toBe(201)
})
