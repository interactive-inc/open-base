import { execSql } from "@system/test/local-d1/exec-sql.test-support"
import { CancelSystemProcedure } from "@system/application/workflow/cancel-system-procedure"
import { expect, setDefaultTimeout, spyOn, test } from "bun:test"
import { readFileSync } from "node:fs"
import { drizzle } from "drizzle-orm/d1"
import { createSystemWorkTestFixture } from "@system/test/create-system-work-test-fixture.test-support"
import { StartSystemProcedure } from "@system/application/workflow/start-system-procedure"
import { SystemD1WorkflowAdapter } from "@system/infrastructure/adapters/workflow/system-d1-workflow.adapter"
import { SystemD1ProposalAdapter } from "@system/infrastructure/adapters/workflow/system-d1-proposal.adapter"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { proposalDigestSchema } from "@system/domain/schemas/workflow/system-case-reference.schema"
import { systemFactory } from "@system/interface/request-environment/system-factory"
import { SystemHTTPException } from "@system/interface/errors"
import { AccessTokenService } from "@system/lib/auth/access-token-service"
import { SYSTEM_ACCESS_TOKEN_PROFILE } from "@system/lib/auth/system-access-token-profile"
import { GET } from "@system/interface/routes/system.proposals.$number.versions.$version"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

async function fixture() {
  const f = await createSystemWorkTestFixture()
  for (const name of [
    "system-workflow",
    "system-decision-policy",
    "system-procedure",
    "system-procedure-delegation",
  ])
    await execSql(
      f.db,
      readFileSync(new URL(`../infrastructure/schema/${name}.sql`, import.meta.url), "utf8"),
    )
  await execSql(
    f.db,
    `
    INSERT INTO system_procedure_definitions(key,current_revision,status,created_at,updated_at) VALUES ('change',1,'active',100,100);
    INSERT INTO system_procedure_definition_revisions(procedure_key,revision,title,category,input_schema_json,decision_policy_json,created_by_account_id,created_at)
      VALUES ('change',1,'Change','operation','{}','{}','45712a13-6a79-4dff-b2b0-d518052d6101',100);
    INSERT INTO system_procedure_numbers(procedure_key) VALUES ('change');
    INSERT INTO system_iam_role_permissions (role_id, permission_key)
      SELECT id, 'system:procedure:read' FROM system_iam_roles WHERE key IN ('role:owner','role:other','role:recipient');
    INSERT INTO system_iam_role_permissions (role_id, permission_key)
      SELECT id, 'system:procedure:read:all' FROM system_iam_roles WHERE key = 'role:recipient';
  `,
  )
  const start = new StartSystemProcedure({
    writer: new SystemD1WorkflowAdapter({ env: { DB: f.db } }),
  })
  const firstTask = {
    key: "review",
    requiredApprovals: 1,
    openedAt: f.clock.now,
    dueAt: null,
    candidates: [
      {
        accountId: zAccountId.parse("86bb9cb9-9f16-4b64-865d-2e7954cf484d"),
        source: "primary" as const,
        evidenceContext: "authority",
        evidenceKind: "qualification",
        evidenceId: "qualification:1",
        evidenceVersion: "1",
        eligibilityDigest: proposalDigestSchema.parse("a".repeat(64)),
        eligibleFrom: null,
        resolvedAt: f.clock.now,
      },
    ],
    excludedAccountIds: [],
  }
  const first = await start.run({
    seriesId: "c7a1e2f0-3b4d-4e5f-8a6b-7c8d9e0f1a2b",
    version: 1,
    procedureKey: "change",
    procedureRevision: 1,
    body: { original: "retained" },
    createdByAccountId: zAccountId.parse("45712a13-6a79-4dff-b2b0-d518052d6101"),
    supersedesProposalId: null,
    createdAt: f.clock.now,
    firstTask,
  })
  if (first instanceof Error) throw first
  const second = await start.run({
    seriesId: first.proposal.seriesId,
    version: 2,
    procedureKey: "change",
    procedureRevision: 1,
    body: { revised: "retained" },
    createdByAccountId: zAccountId.parse("45712a13-6a79-4dff-b2b0-d518052d6101"),
    supersedesProposalId: first.proposal.id,
    createdAt: new Date(f.clock.now.getTime() + 1),
    firstTask: { ...firstTask, openedAt: new Date(f.clock.now.getTime() + 1) },
  })
  if (second instanceof Error) throw second
  f.clock.now = new Date(f.clock.now.getTime() + 2)
  const secret = "proposal-history-test-secret"
  const app = systemFactory
    .createApp()
    .use("*", async (c, next) => {
      c.set("now", () => f.clock.now)
      c.set("database", drizzle(f.db))
      await next()
    })
    .onError((error, c) =>
      error instanceof SystemHTTPException
        ? c.json({ error: error.code }, error.status)
        : c.json({ error: "internal", message: error.message }, 500),
    )
    .get("/system/proposals/:number/versions/:version", ...GET)
  const headers = new Map<string, Record<string, string>>()
  for (const account of [
    "45712a13-6a79-4dff-b2b0-d518052d6101",
    "28689052-c77f-42e5-8f85-1b461d9f5514",
    "86bb9cb9-9f16-4b64-865d-2e7954cf484d",
    "282b84eb-787d-4655-a88b-c072960fc970",
  ]) {
    const token = await new AccessTokenService({ profile: SYSTEM_ACCESS_TOKEN_PROFILE }).create(
      { accountId: account, tokenVersion: 0 },
      secret,
      new Date(f.claims(account).issuedAtMs),
    )
    if (token instanceof Error) throw token
    headers.set(account, { authorization: `Bearer ${token}` })
  }
  const request = (account: string, version = 1) =>
    app.request(
      `/system/proposals/${first.number}/versions/${version}`,
      { headers: headers.get(account) },
      { DB: f.db, JWT_SECRET: secret },
    )
  return { ...f, first, second, request }
}

test("Company・業務コードなしで取消済み原版と再提出版を読み、退職相当の停止主体も履歴に残す", async () => {
  const f = await fixture()
  const original = await f.request("45712a13-6a79-4dff-b2b0-d518052d6101")
  expect(original.status).toBe(200)
  expect(await original.json()).toMatchObject({
    version: 1,
    body_json: '{"original":"retained"}',
    digest: f.first.proposal.digest,
    supersedes_proposal_id: null,
    case: { status: "cancelled" },
  })
  const revised = await f.request("45712a13-6a79-4dff-b2b0-d518052d6101", 2)
  expect(revised.status).toBe(200)
  expect(await revised.json()).toMatchObject({
    version: 2,
    supersedes_proposal_id: f.first.proposal.id,
  })
  expect((await f.request("45712a13-6a79-4dff-b2b0-d518052d6101", 3)).status).toBe(404)
  expect((await f.request("45712a13-6a79-4dff-b2b0-d518052d6101", 0)).status).toBe(400)
  await execSql(
    f.db,
    "UPDATE system_accounts SET status='suspended', token_version=token_version+1, updated_at=updated_at+1 WHERE id='45712a13-6a79-4dff-b2b0-d518052d6101'",
  )
  expect((await f.request("86bb9cb9-9f16-4b64-865d-2e7954cf484d")).status).toBe(200)
})

test("手続きの現行版を変更しても提案時の定義原文を返す", async () => {
  const f = await fixture()
  await execSql(
    f.db,
    `
    INSERT INTO system_procedure_definition_revisions
      (procedure_key,revision,title,category,input_schema_json,decision_policy_json,created_by_account_id,created_at)
      VALUES ('change',2,'Changed definition','revised','{"type":"object"}','{"revised":true}','45712a13-6a79-4dff-b2b0-d518052d6101',101);
    UPDATE system_procedure_definitions SET current_revision=2,updated_at=101 WHERE key='change';
  `,
  )
  const response = await f.request("45712a13-6a79-4dff-b2b0-d518052d6101")
  expect(response.status).toBe(200)
  expect(await response.json()).toMatchObject({
    procedure_key: "change",
    procedure_revision: 1,
    procedure_definition: {
      key: "change",
      revision: 1,
      title: "Change",
      category: "operation",
      description: null,
      input_schema_json: "{}",
      decision_policy_json: "{}",
      completion_operation_key: null,
    },
  })
})

test("関係のない主体と管理者だけの権限を拒否し、関係による拒否を監査する", async () => {
  const f = await fixture()
  expect((await f.request("28689052-c77f-42e5-8f85-1b461d9f5514")).status).toBe(403)
  expect((await f.request("282b84eb-787d-4655-a88b-c072960fc970")).status).toBe(403)
  expect((await f.request("anonymous")).status).toBe(401)
  expect(
    (
      await f.db
        .prepare(
          "SELECT outcome,reason_code FROM system_audit_events WHERE action='system.proposal.history.read'",
        )
        .all<Record<string, unknown>>()
    ).results,
  ).toEqual([{ outcome: "denied", reason_code: "not_participant" }])
})

test("参照中の権限取消は本文の開示と成功監査を拒否する", async () => {
  const f = await fixture()
  const original = SystemD1ProposalAdapter.prototype.listTasks.bind(
    new SystemD1ProposalAdapter({ env: { DB: f.db } }),
  )
  const spy = spyOn(SystemD1ProposalAdapter.prototype, "listTasks").mockImplementationOnce(
    async (caseId) => {
      const tasks = await original(caseId)
      await execSql(
        f.db,
        "UPDATE system_role_bindings SET revoked_at=1000 WHERE account_id='45712a13-6a79-4dff-b2b0-d518052d6101'",
      )
      return tasks
    },
  )
  try {
    expect((await f.request("45712a13-6a79-4dff-b2b0-d518052d6101")).status).toBe(503)
  } finally {
    spy.mockRestore()
  }
  expect(
    await f.db
      .prepare(
        "SELECT count(*) AS count FROM system_audit_events WHERE action='system.proposal.history.read'",
      )
      .first<Record<string, unknown>>(),
  ).toEqual({ count: 0 })
})

test("開示監査の保存失敗では本文を返さない", async () => {
  const f = await fixture()
  await execSql(
    f.db,
    "CREATE TRIGGER fail_disclosure BEFORE INSERT ON system_audit_events BEGIN SELECT RAISE(ABORT,'audit unavailable'); END",
  )
  expect((await f.request("45712a13-6a79-4dff-b2b0-d518052d6101")).status).toBe(503)
  await execSql(f.db, "DROP TRIGGER fail_disclosure")
  expect((await f.request("45712a13-6a79-4dff-b2b0-d518052d6101")).status).toBe(200)
})

test("保存済み本文とdigestが一致しない場合は履歴を開示しない", async () => {
  const f = await fixture()
  await execSql(f.db, "DROP TRIGGER system_proposals_prevent_update")
  await f.db
    .prepare("UPDATE system_proposals SET body_json=?1 WHERE id=?2")
    .bind('{"original":"corrupt"}', f.first.proposal.id)
    .run()
  expect((await f.request("45712a13-6a79-4dff-b2b0-d518052d6101")).status).toBe(503)
  expect(
    await f.db
      .prepare(
        "SELECT count(*) AS count FROM system_audit_events WHERE action='system.proposal.history.read'",
      )
      .first<Record<string, unknown>>(),
  ).toEqual({ count: 0 })
})

test("参照中の案件変更は開示を拒否し、再試行で新しい状態を読む", async () => {
  const f = await fixture()
  const original = SystemD1ProposalAdapter.prototype.listTasks.bind(
    new SystemD1ProposalAdapter({ env: { DB: f.db } }),
  )
  const spy = spyOn(SystemD1ProposalAdapter.prototype, "listTasks").mockImplementationOnce(
    async (caseId) => {
      const tasks = await original(caseId)
      expect(
        await new CancelSystemProcedure(new SystemD1WorkflowAdapter({ env: { DB: f.db } })).run({
          number: f.second.number,
          createdByAccountId: zAccountId.parse("45712a13-6a79-4dff-b2b0-d518052d6101"),
          cancelledAt: f.clock.now,
        }),
      ).toBe(true)
      return tasks
    },
  )
  try {
    const response = await f.request("45712a13-6a79-4dff-b2b0-d518052d6101", 2)
    expect({ status: response.status, body: await response.json() }).toMatchObject({ status: 503 })
  } finally {
    spy.mockRestore()
  }
  expect((await f.request("45712a13-6a79-4dff-b2b0-d518052d6101", 2)).status).toBe(200)
})
