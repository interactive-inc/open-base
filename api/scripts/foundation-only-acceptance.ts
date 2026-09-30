import { strict as assert } from "node:assert"
import { randomUUID } from "node:crypto"
import { z } from "zod"
import { app } from "@/api/app"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"
import { createSystemIdentityTestKey } from "@system/test/create-system-identity-test-key.test-support"
import { createSystemIdentityToken } from "@system/test/create-system-identity-token.test-support"
import { startLocalD1, stopLocalD1 } from "@system/test/local-d1/start-local-d1.test-support"

/**
 * 業務contextを一つも登録しないWorkerで、SystemとCompanyだけの受入を通す。
 * 会社の初期化、人・雇用・組織・責務と時点参照、パスワードと外部IdPの認証と再認証、
 * 機械主体、共通の作業承認、監査、通知を、実migrationを適用したローカルD1で順に確かめる。
 */

type Env = Readonly<Record<string, unknown>>
type Json = Record<string, unknown>

const ORGANIZATION = COMPANY_DEFAULT_ORGANIZATION_ID
const ROOT_PASSWORD = "correct horse battery staple"

async function call(
  env: Env,
  method: string,
  path: string,
  options: Readonly<{ token?: string; headers?: Record<string, string>; body?: unknown }> = {},
): Promise<{ status: number; body: Json; etag: string | null }> {
  const response = await app.request(
    path,
    {
      method,
      headers: {
        "content-type": "application/json",
        ...(options.token === undefined ? {} : { authorization: `Bearer ${options.token}` }),
        ...options.headers,
      },
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    },
    env,
  )
  const text = await response.text()
  let body: Json = {}
  if (text.length > 0) {
    try {
      body = JSON.parse(text) as Json
    } catch {
      body = { text }
    }
  }
  return { status: response.status, body, etag: response.headers.get("etag") }
}

function expectStatus(
  result: Readonly<{ status: number; body: Json }>,
  status: number,
  label: string,
): Json {
  assert.equal(result.status, status, `${label}: ${JSON.stringify(result.body)}`)
  return result.body
}

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

// 業務contextのrouteを一つでも含むWorkerでは、この受入は基盤だけの成立を示さない。
const businessRoutes = app.routes.filter(
  (route) => route.method !== "ALL" && !/^\/(?:system|company)(?:\/|$)/u.test(route.path),
)
assert.deepEqual(
  businessRoutes.map((route) => `${route.method} ${route.path}`),
  [],
  "SystemとCompany以外のrouteが登録されています",
)

const local = await startLocalD1({ migrated: ["foundation-only-acceptance"] })
try {
  const identityKey = await createSystemIdentityTestKey()
  const env: Env = {
    DB: await local.database("foundation-only-acceptance"),
    BOOTSTRAP_TOKEN: "foundation-acceptance-bootstrap-token",
    JWT_SECRET: "foundation-acceptance-jwt-secret-value",
    PEPPER_SECRET: "foundation-acceptance-pepper-value",
    AUDIT_HMAC_SECRET: "foundation-acceptance-audit-value",
    COMPANY_TIME_ZONE: "Asia/Tokyo",
    IDENTITY_ISSUER: "https://identity-provider.example/",
    IDENTITY_AUDIENCE: "urn:system:identity-login",
    IDENTITY_JWKS: identityKey.jwks,
  }
  const identityToken = (sub: string, overrides: Readonly<{ authTime?: number | null }> = {}) =>
    createSystemIdentityToken(identityKey.signingKey, Math.floor(Date.now() / 1000), {
      sub,
      jti: randomUUID(),
      audience: "urn:system:identity-login",
      keyId: identityKey.keyId,
      ...overrides,
    })

  // 初期化とパスワードログイン
  expectStatus(
    await call(env, "POST", "/system/bootstrap", {
      body: { token: env.BOOTSTRAP_TOKEN, email: "root@example.com", password: ROOT_PASSWORD },
    }),
    201,
    "System初期化",
  )
  const rootSession = z.object({ access_token: z.string(), account_id: z.string() }).parse(
    expectStatus(
      await call(env, "POST", "/system/sessions", {
        body: { subject: "root@example.com", password: ROOT_PASSWORD },
      }),
      201,
      "パスワードログイン",
    ),
  )
  const root = rootSession.access_token
  expectStatus(
    await call(env, "POST", "/system/sessions", {
      body: { subject: "root@example.com", password: "wrong password value" },
    }),
    401,
    "誤ったパスワードのログイン",
  )

  // パスワードによる再認証。再認証の無い管理操作は拒否する。
  expectStatus(
    await call(env, "POST", "/system/step-up-grants", {
      token: root,
      body: { method: "password", password: "wrong password value" },
    }),
    401,
    "誤ったパスワードの再認証",
  )
  const stepUp = z.object({ step_up_token: z.string() }).parse(
    expectStatus(
      await call(env, "POST", "/system/step-up-grants", {
        token: root,
        body: { method: "password", password: ROOT_PASSWORD },
      }),
      201,
      "パスワードの再認証",
    ),
  ).step_up_token
  const elevated = { "x-system-step-up": stepUp }
  expectStatus(
    await call(env, "POST", "/system/accounts", { token: root }),
    403,
    "再認証の無い管理操作",
  )

  // 会社の初期化
  expectStatus(
    await call(env, "POST", "/company/bootstrap", {
      token: root,
      headers: { "idempotency-key": "foundation-company-bootstrap" },
      body: {
        name: "First Member",
        code: "FIRST-001",
        organization_name: "Example Company",
        representative_name: "Confirmed Representative",
        initial_responsibilities: [],
        hire_date: "2026-01-01",
        employment_type: "PART_TIME",
        locale: "ja-JP",
        time_zone: "Asia/Tokyo",
        fiscal_year_start_month: 4,
        reason: "Confirmed company facts",
      },
    }),
    201,
    "会社の初期化",
  )

  // 人・従業員・雇用・組織・責務を会社版へ書き、時点参照で前後を読む
  const company = { "x-company-organization-id": ORGANIZATION }
  const snapshot = expectStatus(
    await call(env, "GET", "/company/organization-snapshots", { token: root, headers: company }),
    200,
    "組織snapshot",
  )
  const rootUnit = z
    .object({
      organizationRevision: z.number(),
      resources: z.array(
        z.object({
          type: z.string(),
          effectiveFrom: z.string(),
          attributes: z.record(z.string(), z.unknown()),
        }),
      ),
    })
    .parse(snapshot)
  let revision = rootUnit.organizationRevision
  const rootOrganizationUnit = rootUnit.resources.find(
    (resource) => resource.type === "organization-unit" && resource.attributes.kind === "COMPANY",
  )
  assert.ok(rootOrganizationUnit !== undefined, "会社の最上位組織がありません")
  const startsOn = rootOrganizationUnit.effectiveFrom
  const renamedOn = addDays(startsOn, 30)
  const write = async (path: string, body: unknown, label: string) => {
    const result = await call(env, "POST", path, {
      token: root,
      headers: { ...company, "idempotency-key": randomUUID(), "if-match": `"${revision}"` },
      body,
    })
    const written = z
      .object({ organizationRevision: z.number() })
      .parse(expectStatus(result, 201, label))
    revision = written.organizationRevision
    return revision
  }
  const envelope = (type: string, id: string, attributes: Record<string, unknown>) => ({
    organizationId: ORGANIZATION,
    type,
    id,
    revision: 1,
    state: "active",
    effectiveFrom: startsOn,
    effectiveTo: null,
    attributes,
  })
  const personId = randomUUID()
  const employeeId = randomUUID()
  const person = envelope("person", personId, { officialName: "Example Person" })
  await write("/company/people", { reason: "Hire", resources: [person] }, "人の登録")
  await write(
    "/company/employees",
    {
      reason: "Hire",
      resources: [envelope("employee", employeeId, { personId, employeeCode: "EXAMPLE-002" })],
    },
    "従業員の登録",
  )
  await write(
    "/company/employments",
    {
      reason: "Hire",
      resources: [
        envelope("employment", randomUUID(), {
          employeeId,
          status: "ACTIVE",
          employmentType: "FULL_TIME",
        }),
      ],
    },
    "雇用の登録",
  )
  const unitId = randomUUID()
  await write(
    "/company/organization-changes",
    {
      reason: "Create a department",
      resources: [
        envelope("organization-unit", randomUUID(), {
          organizationUnitId: unitId,
          code: "EXAMPLE-DEPT",
          officialName: "Example Department",
          kind: "DEPARTMENT",
          parentOrganizationUnitId: rootOrganizationUnit.attributes.organizationUnitId,
        }),
      ],
    },
    "組織の登録",
  )
  await write(
    "/company/definitions",
    {
      reason: "Define approval responsibility",
      resources: [
        envelope("responsibility", "responsibility:acceptance", {
          code: "ACCEPTANCE",
          officialName: "Acceptance approver",
        }),
      ],
    },
    "責務の定義",
  )
  await write(
    "/company/organization-changes",
    {
      reason: "Assign approval responsibility",
      resources: [
        envelope("responsibility-assignment", randomUUID(), {
          responsibilityId: "responsibility:acceptance",
          holderType: "employee",
          holderId: employeeId,
          authorityScopeId: null,
          delegationAllowed: false,
        }),
      ],
    },
    "責務の任命",
  )
  const beforeRename = revision
  await write(
    "/company/people",
    {
      reason: "Rename",
      resources: [
        {
          ...person,
          revision: 2,
          effectiveFrom: renamedOn,
          attributes: { officialName: "Renamed Person" },
        },
      ],
    },
    "将来の氏名変更",
  )
  const officialName = async (query: string) => {
    const read = z
      .object({ resources: z.array(z.object({ attributes: z.record(z.string(), z.unknown()) })) })
      .parse(
        expectStatus(
          await call(env, "GET", `/company/people?id=${personId}&${query}`, {
            token: root,
            headers: company,
          }),
          200,
          `人の時点参照 ${query}`,
        ),
      )
    return read.resources[0]?.attributes.officialName
  }
  assert.equal(await officialName(`as_of=${startsOn}`), "Example Person")
  assert.equal(await officialName(`as_of=${renamedOn}`), "Renamed Person")
  assert.equal(
    await officialName(`as_of=${renamedOn}&organization_revision=${beforeRename}`),
    "Example Person",
    "記録した会社版の時点参照が後の変更を含みます",
  )
  const organization = JSON.stringify(
    expectStatus(
      await call(env, "GET", `/company/organization-snapshots?as_of=${startsOn}`, {
        token: root,
        headers: company,
      }),
      200,
      "組織と責務の時点参照",
    ),
  )
  assert.ok(organization.includes("EXAMPLE-DEPT"), "組織の時点参照に登録した組織がありません")
  assert.ok(organization.includes(employeeId), "組織の時点参照に責務の任命がありません")

  // 外部IdPのログインと再認証
  const member = z
    .object({ id: z.string() })
    .parse(
      expectStatus(
        await call(env, "POST", "/system/accounts", { token: root, headers: elevated }),
        201,
        "Account作成",
      ),
    )
  expectStatus(
    await call(env, "POST", `/system/accounts/${member.id}/identities`, {
      token: root,
      headers: elevated,
      body: {
        provider: "oidc",
        subject: "external-member",
        email: "member@example.com",
        email_verified: true,
      },
    }),
    201,
    "外部identityの接続",
  )
  expectStatus(
    await call(env, "POST", "/system/identity-sessions", {
      body: { token: await identityToken("unlinked-subject") },
    }),
    401,
    "未接続の外部identityのログイン",
  )
  const memberSession = z.object({ access_token: z.string(), account_id: z.string() }).parse(
    expectStatus(
      await call(env, "POST", "/system/identity-sessions", {
        body: { token: await identityToken("external-member") },
      }),
      201,
      "外部IdPのログイン",
    ),
  )
  assert.equal(memberSession.account_id, member.id)
  expectStatus(
    await call(env, "POST", "/system/step-up-grants", {
      token: memberSession.access_token,
      body: {
        method: "external_identity",
        token: await identityToken("external-member", { authTime: null }),
      },
    }),
    401,
    "認証時刻の無い外部IdPの再認証",
  )
  expectStatus(
    await call(env, "POST", "/system/step-up-grants", {
      token: memberSession.access_token,
      body: { method: "external_identity", token: await identityToken("external-member") },
    }),
    201,
    "外部IdPの再認証",
  )

  // 機械主体
  const principal = z
    .object({ principal: z.object({ id: z.string(), account_id: z.string() }) })
    .parse(
      expectStatus(
        await call(env, "POST", "/system/principals", {
          token: root,
          headers: elevated,
          body: { kind: "agent", name: "Acceptance agent" },
        }),
        201,
        "機械主体の作成",
      ),
    ).principal
  const credential = z
    .object({ credential: z.object({ id: z.string() }), secret: z.string() })
    .parse(
      expectStatus(
        await call(env, "POST", `/system/principals/${principal.id}/machine-credentials`, {
          token: root,
          headers: elevated,
          body: { name: "Acceptance credential", expires_at: null, reason: "Acceptance" },
        }),
        201,
        "機械資格情報の発行",
      ),
    )
  const role = z.object({ id: z.string() }).parse(
    expectStatus(
      await call(env, "POST", "/system/roles", {
        token: root,
        headers: elevated,
        body: {
          key: "acceptance:agent",
          name: "Acceptance agent",
          description: null,
          resource_type: null,
          permission_keys: ["system:work:perform", "system:work:read"],
        },
      }),
      201,
      "roleの作成",
    ),
  )
  expectStatus(
    await call(env, "POST", `/system/accounts/${principal.account_id}/role-bindings`, {
      token: root,
      headers: elevated,
      body: { role_id: role.id, resource: null },
    }),
    201,
    "roleの割当",
  )
  const machine = z.object({ access_token: z.string() }).parse(
    expectStatus(
      await call(env, "POST", "/system/machine-sessions", {
        body: { credential_id: credential.credential.id, secret: credential.secret },
      }),
      201,
      "機械sessionの発行",
    ),
  ).access_token
  expectStatus(
    await call(env, "POST", "/system/machine-sessions", {
      body: { credential_id: credential.credential.id, secret: "0".repeat(64) },
    }),
    401,
    "誤った機械資格情報",
  )
  expectStatus(
    await call(env, "GET", "/system/work-items", { token: machine }),
    200,
    "機械主体の参照",
  )

  // 共通の作業承認
  const workItemId = randomUUID()
  const command = (expectedRevision: number, extra: Record<string, unknown> = {}) => ({
    commandId: randomUUID(),
    expectedRevision,
    reason: "Acceptance",
    ...extra,
  })
  expectStatus(
    await call(env, "POST", "/system/work-items", {
      token: root,
      body: {
        ...command(0),
        id: workItemId,
        title: "Acceptance work",
        instructions: "Summarize the acceptance run",
        acceptanceCriteria: "A summary exists",
        assigneeAccountId: principal.account_id,
        dueAt: null,
        previousRevisionId: null,
      },
    }),
    201,
    "作業の依頼",
  )
  expectStatus(
    await call(env, "POST", `/system/work-items/${workItemId}/accept`, {
      token: machine,
      body: command(1),
    }),
    201,
    "作業の受諾",
  )
  const submitted = z
    .object({ workItem: z.object({ result: z.object({ id: z.string(), digest: z.string() }) }) })
    .parse(
      expectStatus(
        await call(env, "POST", `/system/work-items/${workItemId}/results`, {
          token: machine,
          body: command(2, { result: { summary: "Done", evidence: [] } }),
        }),
        201,
        "結果の提出",
      ),
    ).workItem.result
  const approval = command(3, { resultId: submitted.id, resultDigest: submitted.digest })
  expectStatus(
    await call(env, "POST", `/system/work-items/${workItemId}/approve`, {
      token: machine,
      body: approval,
    }),
    403,
    "作業者自身の承認",
  )
  expectStatus(
    await call(env, "POST", `/system/work-items/${workItemId}/approve`, {
      token: root,
      body: approval,
    }),
    403,
    "再認証の無い承認",
  )
  const approved = z.object({ workItem: z.object({ state: z.string() }) }).parse(
    expectStatus(
      await call(env, "POST", `/system/work-items/${workItemId}/approve`, {
        token: root,
        headers: elevated,
        body: approval,
      }),
      201,
      "作業の承認",
    ),
  )
  assert.equal(approved.workItem.state, "completed")
  expectStatus(
    await call(env, "GET", `/system/work-items/${workItemId}/history`, { token: root }),
    200,
    "作業の履歴",
  )

  // 通知
  expectStatus(
    await call(env, "POST", "/system/notifications", {
      token: root,
      body: {
        recipient_account_ids: [member.id],
        kind: "system:acceptance",
        title: "Acceptance notice",
        body: "The foundation acceptance run sent this notice",
        source: null,
      },
    }),
    201,
    "通知の送信",
  )
  const unread = async () =>
    z.object({ unread_count: z.number() }).parse(
      expectStatus(
        await call(env, "GET", "/system/notifications/unread-count", {
          token: memberSession.access_token,
        }),
        200,
        "未読件数",
      ),
    ).unread_count
  assert.equal(await unread(), 1)
  const notice = z
    .object({ notifications: z.array(z.object({ id: z.string() })) })
    .parse(
      expectStatus(
        await call(env, "GET", "/system/notifications", { token: memberSession.access_token }),
        200,
        "通知一覧",
      ),
    ).notifications[0]
  assert.ok(notice !== undefined, "受信者の通知一覧が空です")
  expectStatus(
    await call(env, "PATCH", `/system/notifications/${notice.id}`, {
      token: memberSession.access_token,
      body: { read: true },
    }),
    200,
    "通知の既読",
  )
  assert.equal(await unread(), 0)

  // 監査
  expectStatus(
    await call(env, "GET", "/system/audit-events", { token: memberSession.access_token }),
    403,
    "権限の無い監査参照",
  )
  for (const action of [
    "auth.session.create",
    "auth.step_up.issued",
    "auth.session.identity_login_denied",
    "system.principal.created",
    "auth.machine_token.issued",
    "system.work.approve",
  ]) {
    const events = z
      .object({ total: z.number(), events: z.array(z.object({ event_id: z.string() })) })
      .parse(
        expectStatus(
          await call(env, "GET", `/system/audit-events?action=${action}`, { token: root }),
          200,
          `監査の参照 ${action}`,
        ),
      )
    assert.ok(events.total > 0, `監査に ${action} がありません`)
    const first = events.events[0]
    if (first !== undefined)
      expectStatus(
        await call(env, "GET", `/system/audit-events/${first.event_id}`, { token: root }),
        200,
        `監査の詳細 ${action}`,
      )
  }

  // 機械主体の停止後は、発行済みの機械sessionを拒否する
  expectStatus(
    await call(env, "PATCH", `/system/accounts/${principal.account_id}`, {
      token: root,
      headers: elevated,
      body: { status: "suspended" },
    }),
    200,
    "機械主体の停止",
  )
  expectStatus(
    await call(env, "GET", "/system/work-items", { token: machine }),
    401,
    "停止後の機械session",
  )

  console.log(
    "System・Companyだけの構成: 会社の初期化、人・雇用・組織・責務と時点参照、パスワードと外部IdPの認証と再認証、機械主体、共通の作業承認、通知、監査を確認しました",
  )
} finally {
  await local.dispose()
  await stopLocalD1()
}
