import { expect, setDefaultTimeout, spyOn, test } from "bun:test"
import { rejects } from "node:assert/strict"
import { reviewHttpFixture } from "@/contexts/performance-review/test/review-http.test-support"
import { REVIEW_PERMISSION_KEYS } from "@/contexts/performance-review/domain/catalogs/review-permission.catalog"
import { CreateReviewSheet } from "@/contexts/performance-review/application/create-review-sheet"
import { ChangeReviewSheet } from "@/contexts/performance-review/application/change-review-sheet"
import { ReviewCycleRepository } from "@/contexts/performance-review/infrastructure/repositories/review-cycle.repository"
import { ReviewSheetRepository } from "@/contexts/performance-review/infrastructure/repositories/review-sheet.repository"
import { ReviewAccessAdapter } from "@/contexts/performance-review/infrastructure/adapters/review-access.adapter"
import { ReviewWorkflowAdapter } from "@/contexts/performance-review/infrastructure/adapters/review-workflow.adapter"
import { SystemD1ProcedureDelegationAdapter } from "@system/infrastructure/adapters/workflow/system-d1-procedure-delegation.adapter"
import { SystemD1ProposalAdapter } from "@system/infrastructure/adapters/workflow/system-d1-proposal.adapter"
import { ReviewReadAuthorityAdapter } from "@/contexts/performance-review/infrastructure/adapters/review-read-authority.adapter"
import { D1CompanyResourceRepository } from "@/contexts/company/infrastructure/repositories/core/d1-company-resource.repository"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"
import { ReviewCycleEntity } from "@/contexts/performance-review/domain/entities/review-cycle.entity"

setDefaultTimeout(60000)

type Fixture = Awaited<ReturnType<typeof reviewHttpFixture>>

/** 他の人へ権限が波及しないよう、対象Accountだけに専用roleを付ける。 */
async function permissions(fixture: Fixture, index: number, keys: ReadonlyArray<string>) {
  const accountId = fixture.people[index]!.accountId
  const roleId = crypto.randomUUID()
  await fixture.database
    .prepare(
      "DELETE FROM system_role_bindings WHERE account_id = ? AND role_id IN (SELECT id FROM system_iam_roles WHERE key LIKE 'custom:review-%')",
    )
    .bind(accountId)
    .run()
  await fixture.database
    .prepare(
      "INSERT INTO system_iam_roles (id, key, kind, name, created_at, updated_at) VALUES (?, ?, 'custom', 'Review permissions', 0, 0)",
    )
    .bind(roleId, `custom:review-${roleId}`)
    .run()
  if (keys.length > 0)
    await fixture.database.batch(
      keys.map((key) =>
        fixture.database
          .prepare(
            "INSERT INTO system_iam_role_permissions (role_id, permission_key) VALUES (?, ?)",
          )
          .bind(roleId, key),
      ),
    )
  await fixture.database
    .prepare(
      "INSERT INTO system_role_bindings (id, account_id, role_id, created_at) VALUES (?, ?, ?, 0)",
    )
    .bind(crypto.randomUUID(), accountId, roleId)
    .run()
}

test("評価権限を失った過去の判断者へ共通履歴APIからも評価を開示しない", async () => {
  const fixture = await reviewHttpFixture()
  const submitted = await fixture.change(0, {
    operation: "submit_goals",
    expected_revision: 1,
    reason: "提出",
  })
  await fixture.change(1, {
    operation: "decide",
    action: "approve",
    target: await fixture.target(),
    expected_revision: 2,
    reason: "確認",
  })
  await permissions(fixture, 1, ["system:procedure:read"])
  expect((await fixture.call(1, `/performance-review/sheets/${fixture.sheet.id}`)).status).toBe(403)
  expect(
    (await fixture.call(1, `/system/proposals/${submitted.approval!.number}/versions/1`)).status,
  ).toBe(404)
})

test("共通の全件閲覧権限でも無関係な評価と無効化した業務の内容は開示しない", async () => {
  const fixture = await reviewHttpFixture()
  const submitted = await fixture.change(0, {
    operation: "submit_goals",
    expected_revision: 1,
    reason: "提出",
  })
  await permissions(fixture, 3, ["system:procedure:read", "system:procedure:read:all"])
  expect((await fixture.call(3, `/performance-review/sheets/${fixture.sheet.id}`)).status).toBe(403)
  const path = `/system/proposals/${submitted.approval!.number}/versions/1`
  expect((await fixture.call(3, path)).status).toBe(404)
  expect(
    (await fixture.call(3, path, undefined, { DISABLED_DEFAULT_APPS: "performance-review" }))
      .status,
  ).toBe(404)
})

/** 全社閲覧を与えず、実際の委任と固定した承認規程で提出する。 */
async function delegatedFixture() {
  const fixture = await reviewHttpFixture()
  await permissions(fixture, 3, ["performance_review:read", "performance_review:decide"])
  const input = {
    ...fixture.cycleInput,
    id: crypto.randomUUID(),
    goal_workflow: {
      ...fixture.workflow,
      steps: fixture.workflow.steps.map((step) => ({ ...step, allow_delegation: true })),
    },
  }
  const cycle = await fixture.cycleService.run(
    input,
    await fixture.command("create_cycle", input, input.id),
  )
  const context = fixture.context(0)
  const sheetInput = { id: crypto.randomUUID(), cycle_id: cycle.id, goals: [fixture.goal] }
  const sheet = await new CreateReviewSheet({
    repository: new ReviewSheetRepository(context),
    cycles: new ReviewCycleRepository(context),
    access: new ReviewAccessAdapter(context),
    accountId: context.actor.accountId,
    employeeId: context.actor.employeeId,
    now: context.now,
  }).run(sheetInput, await fixture.command("create_sheet", sheetInput, sheetInput.id))
  const submit = { operation: "submit_goals" as const, expected_revision: 1, reason: "提出" }
  await new ChangeReviewSheet({
    repository: new ReviewSheetRepository(context),
    access: new ReviewAccessAdapter(context),
    workflow: new ReviewWorkflowAdapter(context),
    accountId: context.actor.accountId,
    now: context.now,
  }).run(sheet.id, submit, await fixture.command(submit.operation, submit, sheet.id))
  const delegations = new SystemD1ProcedureDelegationAdapter(context)
  const delegation = await delegations.create({
    delegatorAccountId: fixture.people[1]!.accountId,
    delegateAccountId: fixture.people[3]!.accountId,
    procedureKey: null,
    startsAt: new Date(fixture.at.getTime() - 1000),
    endsAt: new Date(fixture.at.getTime() + 600000),
    createdAt: new Date(fixture.at.getTime() - 2000),
  })
  if (delegation instanceof Error || delegation === "overlap")
    throw new Error("delegation setup failed")
  return { ...fixture, delegatedSheet: sheet, delegations, delegation }
}

test("全社閲覧のない正当な委任先も一覧・詳細・履歴を読み、取消後はすべて拒否する", async () => {
  const fixture = await delegatedFixture()
  const path = `/performance-review/sheets/${fixture.delegatedSheet.id}`
  expect((await fixture.call(3, path)).status).toBe(200)
  expect((await fixture.call(3, `${path}/history`)).status).toBe(200)
  const inbox = await fixture.call(3, "/performance-review/sheets?scope=inbox")
  expect(await inbox.json()).toMatchObject({ data: [{ id: fixture.delegatedSheet.id }] })
  await fixture.delegations.revoke({
    number: fixture.delegation.number,
    delegatorAccountId: fixture.people[1]!.accountId,
    revokedAt: fixture.at,
  })
  expect((await fixture.call(3, path)).status).toBe(403)
  expect((await fixture.call(3, `${path}/history`)).status).toBe(403)
  expect(
    await (await fixture.call(3, "/performance-review/sheets?scope=inbox")).json(),
  ).toMatchObject({ data: [] })
})

test("本人・評価者・無関係な利用者・全社閲覧者・管理者の閲覧範囲を分ける", async () => {
  const fixture = await reviewHttpFixture()
  const localKeys = REVIEW_PERMISSION_KEYS.filter((key) => key !== "performance_review:read:all")
  for (const index of [0, 1, 2, 3]) await permissions(fixture, index, localKeys)
  const path = `/performance-review/sheets/${fixture.sheet.id}`
  expect((await fixture.call(0, path)).status).toBe(200)
  expect((await fixture.call(1, path)).status).toBe(403)
  await fixture.change(0, { operation: "submit_goals", expected_revision: 1, reason: "提出" })
  expect((await fixture.call(1, path)).status).toBe(200)
  expect((await fixture.call(3, path)).status).toBe(403)
  expect((await fixture.call(3, `${path}/history`)).status).toBe(403)
  expect((await fixture.call(3, "/performance-review/sheets?scope=all")).status).toBe(403)
  await permissions(fixture, 3, ["performance_review:read", "performance_review:read:all"])
  expect((await fixture.call(3, path)).status).toBe(200)
  await permissions(fixture, 3, ["system:admin"])
  expect((await fixture.call(3, path)).status).toBe(200)
  expect((await fixture.call(1, "/performance-review/sheets?scope=all")).status).toBe(403)
})

/** 従業員番号を公開Company経由で訂正し、資格の変化を実データとして作る。 */
async function employeeCode(fixture: Fixture, index: number, code: string) {
  const employees = await new D1CompanyResourceRepository({ database: fixture.database }).findMany({
    organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
    types: ["employee"],
    ids: [fixture.people[index]!.employeeId],
  })
  if (!employees.ok || employees.resources[0] === undefined) throw new Error("employee missing")
  const employee = employees.resources[0]
  await fixture.write([
    {
      organizationId: employee.organizationId,
      type: employee.type,
      id: employee.id,
      state: employee.state,
      effectiveFrom: employee.effectiveFrom,
      effectiveTo: employee.effectiveTo,
      revision: employee.revision + 1,
      attributes: { ...employee.attributes, employeeCode: code },
    },
  ])
}

test("従業員番号の再割当てで旧評価者も新しい番号の保持者も既存案件を読めない", async () => {
  const fixture = await reviewHttpFixture()
  await fixture.change(0, { operation: "submit_goals", expected_revision: 1, reason: "提出" })
  const path = `/performance-review/sheets/${fixture.sheet.id}`
  expect((await fixture.call(1, path)).status).toBe(200)
  await employeeCode(fixture, 1, "OLD-REVIEWER")
  await employeeCode(fixture, 3, "R2")
  for (const index of [1, 3]) {
    expect((await fixture.call(index, path)).status).toBe(403)
    expect((await fixture.call(index, `${path}/history`)).status).toBe(403)
  }
})

test.each(["detail", "history", "inbox"] as const)(
  "%sの取得中に委任が取り消されたら内容を開示しない",
  async (view) => {
    const fixture = await delegatedFixture()
    const prototype = SystemD1ProposalAdapter.prototype
    const query = new SystemD1ProposalAdapter(fixture.context(3))
    const original = query.findDelegation.bind(query)
    const spy = spyOn(prototype, "findDelegation").mockImplementation(async (input) => {
      const delegation = await original(input)
      if (delegation !== null && !(delegation instanceof Error))
        await fixture.delegations.revoke({
          number: fixture.delegation.number,
          delegatorAccountId: fixture.people[1]!.accountId,
          revokedAt: fixture.at,
        })
      return delegation
    })
    try {
      const base = `/performance-review/sheets/${fixture.delegatedSheet.id}`
      const paths = {
        detail: base,
        history: `${base}/history`,
        inbox: "/performance-review/sheets?scope=inbox",
      }
      const response = await fixture.call(3, paths[view])
      expect(response.status).toBe(409)
      expect(await response.text()).not.toContain(fixture.goal.success_criteria)
    } finally {
      spy.mockRestore()
    }
  },
)

test("会社資格の検査後に資格が失われたら履歴の開示を拒否する", async () => {
  const fixture = await reviewHttpFixture()
  await fixture.change(0, { operation: "submit_goals", expected_revision: 1, reason: "提出" })
  const prototype = ReviewReadAuthorityAdapter.prototype
  const authority = new ReviewReadAuthorityAdapter(fixture.context(1))
  const original = authority.prepare.bind(authority)
  const spy = spyOn(prototype, "prepare").mockImplementation(async (sheet) => {
    const guards = await original(sheet)
    await employeeCode(fixture, 1, "FORMER-REVIEWER")
    return guards
  })
  try {
    const response = await fixture.call(1, `/performance-review/sheets/${fixture.sheet.id}/history`)
    expect(response.status).toBe(409)
    expect(await response.text()).not.toContain(fixture.goal.success_criteria)
  } finally {
    spy.mockRestore()
  }
})

test("全社閲覧の取消が履歴の取得中でも開示を止める", async () => {
  const fixture = await reviewHttpFixture()
  await permissions(fixture, 3, ["performance_review:read", "performance_review:read:all"])
  const prototype = ReviewSheetRepository.prototype
  const repository = new ReviewSheetRepository(fixture.context(3))
  const original = repository.history.bind(repository)
  const spy = spyOn(prototype, "history").mockImplementation(async (id, limit, offset) => {
    const history = await original(id, limit, offset)
    await fixture.database
      .prepare(
        "DELETE FROM system_iam_role_permissions WHERE permission_key = 'performance_review:read:all'",
      )
      .run()
    return history
  })
  try {
    const response = await fixture.call(3, `/performance-review/sheets/${fixture.sheet.id}/history`)
    expect(response.status).toBe(409)
    expect(await response.text()).not.toContain(fixture.goal.success_criteria)
  } finally {
    spy.mockRestore()
  }
})

test("委任の期限切れ・在籍資格の喪失・閲覧権限の取消後は詳細と履歴を拒否する", async () => {
  const fixture = await delegatedFixture()
  const path = `/performance-review/sheets/${fixture.delegatedSheet.id}`
  const later = new Date(fixture.delegation.endsAt.getTime() + 1).toISOString()
  expect((await fixture.call(3, path, undefined, { NOW: later })).status).toBe(403)
  expect((await fixture.call(3, `${path}/history`, undefined, { NOW: later })).status).toBe(403)
  await employeeCode(fixture, 1, "FORMER-DELEGATOR")
  expect((await fixture.call(3, path)).status).toBe(403)
  await permissions(fixture, 3, ["performance_review:decide"])
  expect((await fixture.call(3, `${path}/history`)).status).toBe(403)
})

test("評価者の判断権限だけでは他人の目標を変更できず、機械主体に評価を開示しない", async () => {
  const fixture = await reviewHttpFixture()
  const context = fixture.context(1)
  const machine = {
    ...context,
    actor: {
      ...context.actor,
      authentication: { ...context.actor.authentication, machineCredentialId: crypto.randomUUID() },
    },
  }
  await rejects(
    new ReviewAccessAdapter(machine).prepare("performance_review:read"),
    /human_session_required/,
  )
  const response = await fixture.call(
    1,
    `/performance-review/sheets/${fixture.sheet.id}/commands`,
    {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
      body: JSON.stringify({
        operation: "revise_goals",
        expected_revision: 1,
        reason: "他人の変更",
        goals: [fixture.goal],
      }),
    },
  )
  expect(response.status).toBe(403)
  const own = await fixture.call(0, `/performance-review/sheets/${fixture.sheet.id}`)
  expect(own.headers.get("cache-control")).toBe("no-store")
})

test("人のPrincipalを確認できない主体は、閲覧権限と従業員対応があっても拒否する", async () => {
  const fixture = await reviewHttpFixture()
  await fixture.database
    .prepare("DELETE FROM system_principals WHERE account_id = ?")
    .bind(fixture.people[0]!.accountId)
    .run()
  await rejects(
    new ReviewAccessAdapter(fixture.context(0)).prepare("performance_review:read"),
    /human_session_required/,
  )
})

test("期間作成が確定して応答だけ失敗しても、資格喪失後に成功済み内容を再送しない", async () => {
  const fixture = await reviewHttpFixture()
  const id = crypto.randomUUID()
  const input = { ...fixture.cycleInput, id }
  const cycle = ReviewCycleEntity.create({
    ...fixture.cycle,
    id,
    goals_procedure_key: `review_${id.replaceAll("-", "")}_goals`,
    evaluation_procedure_key: `review_${id.replaceAll("-", "")}_evaluation`,
  })
  const context = fixture.context(0)
  const access = await new ReviewAccessAdapter(context).prepare("performance_review:manage")
  const statements = new ReviewWorkflowAdapter(context).prepareCycle(cycle, {
    goals: input.goal_workflow,
    evaluation: input.evaluation_workflow,
  })
  const command = await fixture.command("create_cycle", input, id)
  const repository = new ReviewCycleRepository(context)
  const batch = fixture.database.batch.bind(fixture.database)
  const spy = spyOn(fixture.database, "batch").mockImplementationOnce(async (statements_) => {
    await batch(statements_)
    await fixture.database
      .prepare(
        "DELETE FROM system_iam_role_permissions WHERE permission_key = 'performance_review:manage'",
      )
      .run()
    throw new Error("response_unavailable")
  })
  try {
    await rejects(
      repository.save(cycle, command, statements, access.guards),
      /system_read_authorization_changed/,
    )
    expect((await repository.find(id))?.data.id).toBe(id)
  } finally {
    spy.mockRestore()
  }
})
