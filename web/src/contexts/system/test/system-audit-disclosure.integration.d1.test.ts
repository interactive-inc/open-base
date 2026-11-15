import { SystemAuditDisclosurePolicyEntity } from "@system/domain/entities/system-audit-disclosure-policy.entity"
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
  const rawTokens = new Map<string, string>()
  async function headers(id: string) {
    const session = await sessions.issue.execute({
      accountId: zAccountId.parse(id),
      tokenVersion: 0,
      now: new Date(),
      auditContext: { authorizationJson: null, metadataJson: null },
    })
    if (session instanceof Error || session.kind === "rejected")
      throw new Error("session issuance failed")
    rawTokens.set(id, session.rawToken)
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
  const logout = async (accountId: string) => {
    const rawToken = rawTokens.get(accountId)
    if (rawToken === undefined) throw new Error("session missing")

    const revoked = await sessions.revoke.execute({
      rawToken,
      now: new Date(),
      auditContext: { authorizationJson: null, metadataJson: null },
    })
    if (revoked instanceof Error) throw revoked
  }
  return { db, clock, admin, reader, other, command, request, publish, read, logout }
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
    sessionFamilyId: null,
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

test("入口の認証後・設定保存前のlogoutで変更と成功監査を保存しない", async () => {
  const fixtureContext = await fixture()
  // oxlint-disable-next-line typescript/unbound-method -- call below preserves the repository receiver.
  const append = SystemAuditDisclosurePolicyRepository.prototype.append
  const interception = spyOn(
    SystemAuditDisclosurePolicyRepository.prototype,
    "append",
  ).mockImplementationOnce(async function (this: SystemAuditDisclosurePolicyRepository, ...args) {
    await fixtureContext.logout("282b84eb-787d-4655-a88b-c072960fc970")
    return append.apply(this, args)
  })
  try {
    expect((await fixtureContext.publish()).status).toBe(403)
    expect(
      await fixtureContext.db
        .prepare("SELECT count(*) AS count FROM system_audit_disclosure_policy_revisions")
        .first<Record<string, unknown>>(),
    ).toEqual({ count: 0 })
    expect(
      await fixtureContext.db
        .prepare(
          "SELECT count(*) AS count FROM system_audit_events WHERE action = 'system.audit.disclosure.published' AND outcome = 'succeeded'",
        )
        .first<Record<string, unknown>>(),
    ).toEqual({ count: 0 })
    expect(
      await fixtureContext.db
        .prepare(
          "SELECT token_version, updated_at FROM system_accounts WHERE id = '282b84eb-787d-4655-a88b-c072960fc970'",
        )
        .first<Record<string, unknown>>(),
    ).toEqual({ token_version: 0, updated_at: 100 })
  } finally {
    interception.mockRestore()
  }
})

test.each(["list", "detail", "after-list"])(
  "入口の認証後のlogoutで監査情報と成功監査を開示しない: %s",
  async (stage) => {
    const fixtureContext = await fixture()
    // oxlint-disable-next-line typescript/unbound-method -- call below preserves the adapter receiver.
    const list = SystemAuditEventQueryAdapter.prototype.list
    // oxlint-disable-next-line typescript/unbound-method -- call below preserves the adapter receiver.
    const findById = SystemAuditEventQueryAdapter.prototype.findById
    const detailInterception = spyOn(
      SystemAuditEventQueryAdapter.prototype,
      "findById",
    ).mockImplementationOnce(async function (this: SystemAuditEventQueryAdapter, ...args) {
      await fixtureContext.logout("f43d89f4-ac52-411f-828b-78838556ce92")
      return findById.apply(this, args)
    })
    const listInterception = spyOn(
      SystemAuditEventQueryAdapter.prototype,
      "list",
    ).mockImplementationOnce(async function (this: SystemAuditEventQueryAdapter, ...args) {
      if (stage === "list") await fixtureContext.logout("f43d89f4-ac52-411f-828b-78838556ce92")
      const page = await list.apply(this, args)
      if (stage === "after-list")
        await fixtureContext.logout("f43d89f4-ac52-411f-828b-78838556ce92")
      return page
    })
    const request = () => {
      if (stage === "detail")
        return fixtureContext.request(`/system/audit-events/${eventId}`, {
          headers: fixtureContext.reader,
        })
      return fixtureContext.read()
    }
    try {
      const response = await request()
      expect(response.status).toBe(503)
      expect(await response.text()).not.toContain("private-")
      expect(
        await fixtureContext.db
          .prepare(
            "SELECT count(*) AS count FROM system_audit_events WHERE action IN ('system.audit.list', 'system.audit.detail') AND outcome = 'succeeded'",
          )
          .first<Record<string, unknown>>(),
      ).toEqual({ count: 0 })
      expect(
        await fixtureContext.db
          .prepare(
            "SELECT token_version, updated_at FROM system_accounts WHERE id = 'f43d89f4-ac52-411f-828b-78838556ce92'",
          )
          .first<Record<string, unknown>>(),
      ).toEqual({ token_version: 0, updated_at: 100 })
    } finally {
      detailInterception.mockRestore()
      listInterception.mockRestore()
    }
  },
)

test("監査開示は別Accountと不在のfamilyを拒否し、sidのない資格は従来どおり扱う", async () => {
  const fixtureContext = await fixture()
  const adapter = new SystemAuditDisclosureReadAdapter({ env: { DB: fixtureContext.db } })
  const foreignFamily = await fixtureContext.db
    .prepare(
      "SELECT family_id FROM system_sessions WHERE account_id = '28689052-c77f-42e5-8f85-1b461d9f5514'",
    )
    .first<string>("family_id")
  if (foreignFamily === null) throw new Error("session missing")

  const input = {
    accountId: "f43d89f4-ac52-411f-828b-78838556ce92",
    tokenVersion: 0,
    permission: "audit:read",
    purpose: null,
    now: at,
  }
  for (const familyId of ["missing-family", foreignFamily])
    expect(await adapter.prepare({ ...input, sessionFamilyId: familyId })).toMatchObject({
      kind: "forbidden",
    })

  await fixtureContext.logout(input.accountId)
  const proof = await adapter.prepare({ ...input, sessionFamilyId: null })
  if (proof instanceof Error) throw proof

  await fixtureContext.db.batch([...proof.assertions])
})

/** 移行時のコピーで残る古いscopeと監査JSONを、独立した試験DBだけに再現する。 */
async function legacyFixture(options: Record<string, unknown> = {}, legacyScope = "legacy-reader") {
  const f = await fixture()
  expect((await f.publish({ ...f.command, ...options })).status).toBe(201)
  const guards = await f.db
    .prepare(`SELECT name, sql FROM sqlite_master WHERE type = 'trigger'
    AND name IN ('system_audit_disclosure_revision_update', 'system_audit_events_prevent_update')`)
    .all<{ name: string; sql: string }>()
  // 識別子の変更を止めるtriggerの名前に依存せず、移行時にだけ可能だったコピーを作る。
  const accountGuards = await f.db
    .prepare(`SELECT name, sql FROM sqlite_master WHERE type = 'trigger'
    AND tbl_name = 'system_accounts' AND sql LIKE '%BEFORE UPDATE OF id, legacy_id%'`)
    .all<{ name: string; sql: string }>()
  const triggers = [
    ...new Map(
      [...guards.results, ...accountGuards.results].map((row) => [row.name, row]),
    ).values(),
  ]
  for (const trigger of triggers) await f.db.prepare(`DROP TRIGGER "${trigger.name}"`).run()
  await f.db
    .prepare("UPDATE system_accounts SET legacy_id = ?1 WHERE id = ?2")
    .bind(legacyScope, f.command.scope)
    .run()
  await f.db
    .prepare(`UPDATE system_audit_events SET after_json = json_set(after_json,
    '$.scope', ?1, '$.actorAccountId', 'legacy-admin')
    WHERE event_id IN (SELECT audit_event_id FROM system_audit_disclosure_policy_revisions WHERE scope = ?2)`)
    .bind(legacyScope, f.command.scope)
    .run()
  await f.db
    .prepare("UPDATE system_audit_disclosure_policy_revisions SET scope = ?1 WHERE scope = ?2")
    .bind(legacyScope, f.command.scope)
    .run()
  for (const trigger of triggers) await f.db.prepare(trigger.sql).run()
  return f
}

test("古い個別設定の目的・項目・対象制限を一覧と詳細で引き継ぎ、監査原本を変えない", async () => {
  const f = await legacyFixture()
  const before = await f.db.prepare("SELECT * FROM system_audit_disclosure_policy_revisions").all()
  const audit = await f.db
    .prepare(
      "SELECT after_json FROM system_audit_events WHERE action = 'system.audit.disclosure.published'",
    )
    .all()
  expect((await f.read()).status).toBe(403)
  expect((await f.read("&purpose=other")).status).toBe(403)
  const response = await f.read("&purpose=review")
  expect(response.status).toBe(200)
  const body = await response.json()
  expect(body).toMatchObject({
    total: 1,
    events: [{ actor_account_id: null, target_id: null, metadata_json: null }],
  })
  expect(JSON.stringify(body)).not.toContain("private-")
  expect(await (await f.read("&purpose=review&target_type=system:session")).json()).toMatchObject({
    total: 0,
    events: [],
  })
  const detail = await f.request(`/system/audit-events/${eventId}?purpose=review`, {
    headers: f.reader,
  })
  expect(detail.status).toBe(200)
  expect(await detail.json()).toMatchObject({
    actor_account_id: null,
    target_id: null,
    metadata_json: null,
  })
  expect((await f.request(`/system/audit-events/${eventId}`, { headers: f.reader })).status).toBe(
    403,
  )
  expect(
    (await f.db.prepare("SELECT * FROM system_audit_disclosure_policy_revisions").all()).results,
  ).toEqual(before.results)
  expect(audit.results).toHaveLength(1)
  expect(
    (
      await f.db
        .prepare(
          "SELECT after_json FROM system_audit_events WHERE action = 'system.audit.disclosure.published'",
        )
        .all()
    ).results,
  ).toEqual(audit.results)
  expect((await f.read("", f.other)).status).toBe(200)
})

test("古い設定・新しい設定・全体設定の積集合で公開範囲を決める", async () => {
  const f = await legacyFixture({
    allowedFields: ["actor_account_id", "target_id", "metadata_json"],
  })
  expect(
    (
      await f.publish({
        ...f.command,
        commandId: crypto.randomUUID(),
        allowedFields: ["actor_account_id", "reason_code", "metadata_json"],
      })
    ).status,
  ).toBe(201)
  expect(
    (
      await f.publish({
        ...f.command,
        scope: "*",
        commandId: crypto.randomUUID(),
        allowedFields: ["target_id", "reason_code", "metadata_json"],
      })
    ).status,
  ).toBe(201)
  const response = await f.read("&purpose=review")
  expect(response.status).toBe(200)
  expect(await response.json()).toMatchObject({
    total: 1,
    events: [
      {
        actor_account_id: null,
        target_id: null,
        reason_code: null,
        metadata_json: '{"value":"private-metadata"}',
      },
    ],
  })
})

test.each([false, true])("古い設定の無効化と期限切れを区別する（有効: %s）", async (enabled) => {
  const f = await legacyFixture({ enabled, expiresAt: new Date(at.getTime() + 1).toISOString() })
  f.clock.now = new Date(at.getTime() + 2)
  const response = await f.read()
  expect(response.status).toBe(enabled ? 403 : 200)
  if (!enabled)
    expect(await response.json()).toMatchObject({ events: [{ target_id: "private-target" }] })
})

test.each([false, true])(
  "利用者の不明な設定や監査との不一致を無視して公開しない（一致: %s）",
  async (matching) => {
    const f = await legacyFixture()
    await f.db.prepare("DROP TRIGGER system_audit_disclosure_revision_update").run()
    await f.db
      .prepare("UPDATE system_audit_disclosure_policy_revisions SET scope = 'unmapped-account'")
      .run()
    if (matching) {
      await f.db.prepare("DROP TRIGGER system_audit_events_prevent_update").run()
      await f.db
        .prepare(`UPDATE system_audit_events SET after_json = json_set(after_json, '$.scope', 'unmapped-account')
      WHERE event_id IN (SELECT audit_event_id FROM system_audit_disclosure_policy_revisions)`)
        .run()
    }
    expect((await f.read()).status).toBe(503)
    expect((await f.request(`/system/audit-events/${eventId}`, { headers: f.reader })).status).toBe(
      503,
    )
  },
)

function repairCommand(
  f: Awaited<ReturnType<typeof fixture>>,
  overrides: Record<string, unknown> = {},
) {
  return { ...f.command, commandId: crypto.randomUUID(), supersedesLegacyRevision: 1, ...overrides }
}

async function configuredPolicy(f: Awaited<ReturnType<typeof fixture>>) {
  const response = await f.request(`/system/audit-disclosure-policies?scope=${f.command.scope}`, {
    headers: f.admin,
  })
  expect(response.status).toBe(200)
  return auditDisclosureCurrentPolicyResponseSchema.parse(await response.json())
}

async function prettyLegacyAudit(f: Awaited<ReturnType<typeof fixture>>) {
  const row = await f.db
    .prepare(`SELECT audit.after_json FROM system_audit_events audit
    JOIN system_audit_disclosure_policy_revisions policy ON policy.audit_event_id = audit.event_id
    WHERE policy.scope = 'legacy-reader' AND policy.revision = 1`)
    .first<string>("after_json")
  const guard = await f.db
    .prepare("SELECT sql FROM sqlite_master WHERE name = 'system_audit_events_prevent_update'")
    .first<string>("sql")
  if (row === null || guard === null) throw new Error("audit fixture missing")
  const pretty = JSON.stringify(
    Object.fromEntries(Object.entries(JSON.parse(row)).reverse()),
    null,
    2,
  )
  await f.db.prepare("DROP TRIGGER system_audit_events_prevent_update").run()
  try {
    await f.db
      .prepare(`UPDATE system_audit_events SET after_json = ?1
      WHERE event_id IN (SELECT audit_event_id FROM system_audit_disclosure_policy_revisions WHERE scope = 'legacy-reader')`)
      .bind(pretty)
      .run()
  } finally {
    await f.db.prepare(guard).run()
  }
  return pretty
}

async function policyRevisionCount(f: Awaited<ReturnType<typeof fixture>>) {
  return f.db
    .prepare("SELECT count(*) AS count FROM system_audit_disclosure_policy_revisions")
    .first<number>("count")
}

test("管理者は旧版を取得し、新しい設定と旧版の解除を監査原本を保って一括保存できる", async () => {
  const f = await legacyFixture()
  const raw = await prettyLegacyAudit(f)
  const original = await f.db
    .prepare("SELECT * FROM system_audit_disclosure_policy_revisions WHERE scope = 'legacy-reader'")
    .first()
  expect(await configuredPolicy(f)).toMatchObject({
    policy: null,
    legacyPolicy: { scope: "legacy-reader", revision: 1, enabled: true },
  })
  const command = repairCommand(f, { allowedFields: ["target_id"], allowedPurposes: null })
  const response = await f.publish(command)
  expect(response.status).toBe(201)
  const published = auditDisclosurePolicyResponseSchema.parse(await response.json())
  expect(published.policy.supersedesLegacyRevision).toBe(1)
  const current = await configuredPolicy(f)
  expect(current).toMatchObject({
    policy: { revision: 1 },
    legacyPolicy: {
      revision: 2,
      enabled: false,
      supersededByAuditEventId: published.policy.auditEventId,
    },
  })
  const retirement = await f.db
    .prepare(`SELECT audit.before_json FROM system_audit_events audit
    JOIN system_audit_disclosure_policy_revisions policy ON policy.audit_event_id = audit.event_id
    WHERE policy.scope = 'legacy-reader' AND policy.revision = 2`)
    .first<string>("before_json")
  expect(retirement).toBe(raw)
  expect(
    await f.db
      .prepare(
        "SELECT * FROM system_audit_disclosure_policy_revisions WHERE scope = 'legacy-reader' AND revision = 1",
      )
      .first<Record<string, unknown>>(),
  ).toEqual(original)
  const originalAudit = await f.db
    .prepare(`SELECT audit.after_json FROM system_audit_events audit
      JOIN system_audit_disclosure_policy_revisions policy ON policy.audit_event_id = audit.event_id
      WHERE policy.scope = 'legacy-reader' AND policy.revision = 1`)
    .first<string>("after_json")
  expect(originalAudit).toBe(raw)
  const read = await f.read()
  expect(read.status).toBe(200)
  expect(await read.json()).toMatchObject({
    events: [{ target_id: "private-target", actor_account_id: null, metadata_json: null }],
  })
  expect((await f.publish(command)).status).toBe(200)
  expect((await f.publish({ ...command, supersedesLegacyRevision: undefined })).status).toBe(409)
  expect(await policyRevisionCount(f)).toBe(3)
})

test("旧版の解除を指定しない新設定では、旧い制限を緩めない", async () => {
  const f = await legacyFixture()
  expect(
    (await f.publish(repairCommand(f, { supersedesLegacyRevision: undefined, enabled: false })))
      .status,
  ).toBe(201)
  expect((await f.read()).status).toBe(403)
  expect(await configuredPolicy(f)).toMatchObject({ legacyPolicy: { revision: 1, enabled: true } })
})

test.each([{ supersedesLegacyRevision: 2 }, { expectedRevision: 99 }])(
  "旧版・現版の競合ではどちらも保存しない: %j",
  async (overrides) => {
    const f = await legacyFixture()
    expect((await f.publish(repairCommand(f, overrides))).status).toBe(409)
    expect(await policyRevisionCount(f)).toBe(1)
  },
)

test("旧設定のない利用者と全体設定を、旧版解除の対象にしない", async () => {
  const f = await fixture()
  expect((await f.publish(repairCommand(f))).status).toBe(409)
  expect((await f.publish(repairCommand(f, { scope: "*" }))).status).toBe(400)
  expect((await f.publish(repairCommand(f, { supersedesLegacyRevision: 0 }))).status).toBe(400)
  expect(await policyRevisionCount(f)).toBe(0)
})

test.each([false, true])(
  "期限を過ぎた旧設定も、管理者が旧版を明示して解除できる（有効: %s）",
  async (enabled) => {
    const f = await legacyFixture({ enabled, expiresAt: new Date(at.getTime() + 1).toISOString() })
    f.clock.now = new Date(at.getTime() + 2)
    expect((await f.read()).status).toBe(enabled ? 403 : 200)
    expect((await f.publish(repairCommand(f, { enabled: false }))).status).toBe(201)
    expect((await f.read()).status).toBe(200)
    expect(await configuredPolicy(f)).toMatchObject({
      legacyPolicy: { revision: 2, enabled: false, expiresAt: null },
    })
  },
)

test("旧設定を解除しても、全体設定の目的と項目制限は残る", async () => {
  const f = await legacyFixture()
  expect(
    (await f.publish({ ...f.command, scope: "*", commandId: crypto.randomUUID() })).status,
  ).toBe(201)
  expect((await f.publish(repairCommand(f, { enabled: false }))).status).toBe(201)
  expect((await f.read()).status).toBe(403)
  expect(await (await f.read("&purpose=review")).json()).toMatchObject({
    events: [{ target_id: null, metadata_json: null }],
  })
})

test.each([false, true])(
  "同時の修復は一度だけ保存し、同じ依頼の再送だけ受け付ける（同じ依頼: %s）",
  async (same) => {
    const f = await legacyFixture()
    const first = repairCommand(f)
    const second = same ? first : repairCommand(f)
    const responses = await Promise.all([f.publish(first), f.publish(second)])
    expect(responses.map((response) => response.status).sort((a, b) => a - b)).toEqual(
      same ? [200, 201] : [201, 409],
    )
    expect(await policyRevisionCount(f)).toBe(3)
  },
)

test("旧版の保存が失敗したら新設定と成功の監査記録も取り消す", async () => {
  const f = await legacyFixture()
  await f.db
    .prepare(`CREATE TRIGGER fail_legacy_retirement BEFORE INSERT ON system_audit_disclosure_policy_revisions
    WHEN NEW.scope = 'legacy-reader' AND NEW.revision = 2 BEGIN SELECT RAISE(ABORT, 'retirement failure'); END`)
    .run()
  expect((await f.publish(repairCommand(f))).status).toBe(503)
  expect(await policyRevisionCount(f)).toBe(1)
  expect(
    await f.db
      .prepare(
        "SELECT count(*) AS count FROM system_audit_events WHERE action = 'system.audit.disclosure.published' AND outcome = 'succeeded'",
      )
      .first<number>("count"),
  ).toBe(1)
})

test("修復の保存直前に管理資格が失われた場合は両方の設定を保存しない", async () => {
  const f = await legacyFixture()
  const append = SystemAuditDisclosurePolicyRepository.prototype.appendReplacingLegacy
  const pending = spyOn(
    SystemAuditDisclosurePolicyRepository.prototype,
    "appendReplacingLegacy",
  ).mockImplementation(async function (
    this: SystemAuditDisclosurePolicyRepository,
    ...args: Parameters<typeof append>
  ) {
    await f.db
      .prepare("UPDATE system_role_bindings SET revoked_at = ?1 WHERE id = ?2")
      .bind(at.getTime(), bindingIdOf("282b84eb-787d-4655-a88b-c072960fc970"))
      .run()
    return append.apply(this, args)
  })
  try {
    expect((await f.publish(repairCommand(f))).status).toBe(403)
    expect(pending).toHaveBeenCalledTimes(1)
    expect(await policyRevisionCount(f)).toBe(1)
  } finally {
    pending.mockRestore()
  }
})

test("管理者以外や再認証のない要求は旧版を解除できない", async () => {
  const f = await legacyFixture()
  const command = repairCommand(f)
  expect((await f.publish(command, f.reader)).status).toBe(403)
  expect((await f.publish(command, { ...f.admin, "x-system-step-up": "" })).status).toBe(403)
  expect(await policyRevisionCount(f)).toBe(1)
})

test.each([false, true])(
  "新設定の監査に旧版の指定がなければ、DBも旧設定だけの解除を拒否する（新設定あり: %s）",
  async (persisted) => {
    const f = await legacyFixture()
    const repository = new SystemAuditDisclosurePolicyRepository({
      env: { DB: f.db },
      assertions: [],
    })
    const old = await repository.findLegacyCurrent(f.command.scope)
    if (old === null || old instanceof Error) throw new Error("legacy fixture missing")
    const { expectedRevision, ...input } = repairCommand(f)
    let props: Record<string, unknown> = {
      ...input,
      actorAccountId: "282b84eb-787d-4655-a88b-c072960fc970",
      revision: expectedRevision + 1,
      recordedAt: at.toISOString(),
      auditEventId: crypto.randomUUID(),
    }
    if (persisted) {
      const response = await f.publish({
        ...input,
        expectedRevision,
        supersedesLegacyRevision: undefined,
      })
      expect(response.status).toBe(201)
      props = {
        ...auditDisclosurePolicyResponseSchema.parse(await response.json()).policy,
        supersedesLegacyRevision: 1,
      }
    }
    const replacement = SystemAuditDisclosurePolicyEntity.create(props)
    if (replacement instanceof Error) throw replacement
    const retirement = old.retireInFavorOf(replacement, {
      commandId: crypto.randomUUID(),
      auditEventId: crypto.randomUUID(),
    })
    if (retirement instanceof Error) throw retirement
    expect(await repository.append(retirement, old)).toMatchObject({ kind: "conflict" })
    expect(await policyRevisionCount(f)).toBe(persisted ? 2 : 1)
  },
)

test("修復後の通常の設定変更は旧版の解除を繰り返さない", async () => {
  const f = await legacyFixture()
  expect((await f.publish(repairCommand(f))).status).toBe(201)
  expect(
    (
      await f.publish({
        ...f.command,
        commandId: crypto.randomUUID(),
        expectedRevision: 1,
        enabled: false,
      })
    ).status,
  ).toBe(201)
  expect(await configuredPolicy(f)).toMatchObject({
    policy: { revision: 2, enabled: false },
    legacyPolicy: { revision: 2, enabled: false },
  })
  expect((await f.read()).status).toBe(200)
  expect(await policyRevisionCount(f)).toBe(4)
})

test.each([false, true])(
  "適用先の変わらない設定も旧操作者の監査原文を保って更新できる（全体: %s）",
  async (global) => {
    const f = await fixture()
    const scope = global ? "*" : f.command.scope
    expect((await f.publish({ ...f.command, scope })).status).toBe(201)
    const guard = await f.db
      .prepare("SELECT sql FROM sqlite_master WHERE name = 'system_audit_events_prevent_update'")
      .first<string>("sql")
    if (guard === null) throw new Error("audit guard missing")
    await f.db.prepare("DROP TRIGGER system_audit_events_prevent_update").run()
    try {
      await f.db
        .prepare(`UPDATE system_audit_events SET after_json = json_set(after_json, '$.actorAccountId', 'legacy-admin')
      WHERE event_id IN (SELECT audit_event_id FROM system_audit_disclosure_policy_revisions WHERE scope = ?1)`)
        .bind(scope)
        .run()
    } finally {
      await f.db.prepare(guard).run()
    }
    const current = await f.request(`/system/audit-disclosure-policies?scope=${scope}`, {
      headers: f.admin,
    })
    expect(current.status).toBe(200)
    expect(auditDisclosureCurrentPolicyResponseSchema.parse(await current.json())).toMatchObject({
      policy: { revision: 1, actorAccountId: "legacy-admin" },
    })
    expect(
      (
        await f.publish({
          ...f.command,
          scope,
          commandId: crypto.randomUUID(),
          expectedRevision: 1,
          enabled: false,
        })
      ).status,
    ).toBe(201)
    expect(await policyRevisionCount(f)).toBe(2)
  },
)

test("別人の現番号にも一致する旧番号は、閲覧にも修復にも使わない", async () => {
  const f = await legacyFixture({}, "28689052-c77f-42e5-8f85-1b461d9f5514")
  expect(
    (
      await f.request(`/system/audit-disclosure-policies?scope=${f.command.scope}`, {
        headers: f.admin,
      })
    ).status,
  ).toBe(503)
  expect((await f.publish(repairCommand(f))).status).toBe(503)
  expect((await f.read("&purpose=review")).status).toBe(503)
  expect((await f.read("&purpose=review", f.other)).status).toBe(503)
  expect(await policyRevisionCount(f)).toBe(1)
})
