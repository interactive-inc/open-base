import { rejects } from "node:assert/strict"
import { D1CompanyResourceRepository } from "@/contexts/company/infrastructure/repositories/core/d1-company-resource.repository"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"
import { expect, setDefaultTimeout, test } from "bun:test"
import { reviewFixture } from "@/contexts/performance-review/test/review-fixture.test-support"
import { ReviewSheetRepository } from "@/contexts/performance-review/infrastructure/repositories/review-sheet.repository"
import { ReviewAccessAdapter } from "@/contexts/performance-review/infrastructure/adapters/review-access.adapter"

setDefaultTimeout(60000)

test("目標提出、二人の承認、自己評価、上長の評価と承認を通して確定し、理由と履歴を保全する", async () => {
  const f = await reviewFixture()
  const submitted = await f.change(0, {
    operation: "submit_goals",
    expected_revision: 1,
    reason: "目標を提出",
  })
  expect(submitted.status).toBe("goals_pending")
  expect(submitted.approval?.number).toBeGreaterThan(0)
  const target = await f.target()
  await expectRejected(
    f.change(0, {
      operation: "decide",
      action: "approve",
      target,
      expected_revision: 2,
      reason: "自己承認",
    }),
  )
  expect(
    (
      await f.change(1, {
        operation: "decide",
        action: "approve",
        target,
        expected_revision: 2,
        reason: "一次確認",
      })
    ).status,
  ).toBe("goals_pending")
  expect(
    (
      await f.change(2, {
        operation: "decide",
        action: "approve",
        target: await f.target(),
        expected_revision: 3,
        reason: "二次確認",
      })
    ).status,
  ).toBe("goals_approved")
  await expectRejected(
    f.change(0, {
      operation: "revise_goals",
      goals: [f.goal],
      expected_revision: 4,
      reason: "承認後の書換え",
    }),
    "goals_locked",
  )
  await f.change(0, {
    operation: "self_evaluate",
    assessments: [{ goal_id: f.goal.id, score: 4, actual: "完了した実績", comment: "根拠" }],
    expected_revision: 4,
    reason: "自己評価",
  })
  await f.change(0, { operation: "submit_evaluation", expected_revision: 5, reason: "評価を提出" })
  const assessments = [{ goal_id: f.goal.id, score: 5, comment: "確認した評価根拠" }]
  await expectRejected(
    f.change(1, {
      operation: "decide",
      action: "approve",
      target: await f.target(),
      expected_revision: 6,
      reason: "評価なし",
    }),
    "assessments_must_cover_each_goal",
  )
  await f.change(1, {
    operation: "decide",
    action: "approve",
    target: await f.target(),
    assessments,
    expected_revision: 6,
    reason: "一次評価",
  })
  const done = await f.change(2, {
    operation: "decide",
    action: "approve",
    target: await f.target(),
    assessments,
    expected_revision: 7,
    reason: "最終評価",
  })
  expect(done.status).toBe("finalized")
  await expectRejected(
    f.change(0, { operation: "cancel", expected_revision: 8, reason: "確定後の取消" }),
    "sheet_closed",
  )
  const history = await new ReviewSheetRepository(f.context(0)).history(f.sheet.id)
  expect(history).toHaveLength(8)
  expect(history.at(-1)).toMatchObject({
    reason: "確認した内容",
    snapshot: { status: "finalized" },
  })
  await expectRejected(
    f.database.prepare("UPDATE performance_review_sheet_revisions SET reason = 'changed'").run(),
  )
})

test("差戻しは新しい版で再提出し、古い提案と同じキーの別コマンドを拒否する", async () => {
  const f = await reviewFixture()
  const submit = { operation: "submit_goals" as const, expected_revision: 1, reason: "提出" },
    key = crypto.randomUUID()
  const first = await f.change(0, submit, key)
  expect(await f.change(0, submit, key)).toEqual(first)
  const old = await f.target()
  await f.change(1, {
    operation: "decide",
    action: "return",
    target: old,
    expected_revision: 2,
    reason: "達成条件の修正",
  })
  await f.change(0, {
    operation: "revise_goals",
    goals: [{ ...f.goal, success_criteria: "測定できる達成条件" }],
    expected_revision: 3,
    reason: "修正",
  })
  await f.change(0, { operation: "submit_goals", expected_revision: 4, reason: "再提出" })
  await expectRejected(
    f.change(1, {
      operation: "decide",
      action: "approve",
      target: old,
      expected_revision: 5,
      reason: "古い内容",
    }),
  )
  await expectRejected(
    f.change(0, { ...submit, expected_revision: 5 }, key),
    "idempotency_key_reused",
  )
  expect(
    await f.database
      .prepare("SELECT count(*) AS n FROM system_human_attestations")
      .first<number>("n"),
  ).toBe(1)
})

test("同時再送は一度だけ提出し、異なる更新は期待版で競合する", async () => {
  const f = await reviewFixture(),
    key = crypto.randomUUID()
  const input = { operation: "submit_goals" as const, expected_revision: 1, reason: "提出" }
  const results = await Promise.all([f.change(0, input, key), f.change(0, input, key)])
  expect(results[0]).toEqual(results[1])
  expect(
    await f.database.prepare("SELECT count(*) AS n FROM system_proposals").first<number>("n"),
  ).toBe(1)
  await expectRejected(
    f.change(0, { operation: "cancel", expected_revision: 1, reason: "古い版" }),
    "review_revision_conflict",
  )
})

test("評価の保存失敗でSystemの承認もrollbackし、同じキーで再試行できる", async () => {
  const f = await reviewFixture()
  await f.change(0, { operation: "submit_goals", expected_revision: 1, reason: "提出" })
  const input = {
      operation: "decide" as const,
      action: "approve" as const,
      target: await f.target(),
      expected_revision: 2,
      reason: "確認",
    },
    key = crypto.randomUUID()
  await f.database
    .prepare(
      "CREATE TRIGGER fail_review_history BEFORE INSERT ON performance_review_sheet_revisions WHEN NEW.operation = 'decide' BEGIN SELECT RAISE(ABORT, 'test_write_failure'); END",
    )
    .run()
  await expectRejected(f.change(1, input, key), "review_decision_conflict")
  expect(
    await f.database
      .prepare("SELECT count(*) AS n FROM system_human_attestations")
      .first<number>("n"),
  ).toBe(0)
  await f.database.prepare("DROP TRIGGER fail_review_history").run()
  expect((await f.change(1, input, key)).revision).toBe(3)
})

test("在籍・判断資格・操作権限を再検査し、権限だけで自己承認や他人の編集を許さない", async () => {
  const f = await reviewFixture()
  await expectRejected(
    f.change(1, {
      operation: "revise_goals",
      goals: [f.goal],
      expected_revision: 1,
      reason: "他人の変更",
    }),
    "sheet_owner_required",
  )
  await f.change(0, { operation: "submit_goals", expected_revision: 1, reason: "提出" })
  const employees = await new D1CompanyResourceRepository({ database: f.database }).findMany({
    organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
    types: ["employee"],
    ids: [f.people[1]!.employeeId],
  })
  if (!employees.ok || employees.resources[0] === undefined) throw new Error("employee missing")
  const employee = employees.resources[0]
  await f.write([
    {
      organizationId: employee.organizationId,
      type: employee.type,
      id: employee.id,
      state: employee.state,
      effectiveFrom: employee.effectiveFrom,
      effectiveTo: employee.effectiveTo,
      revision: employee.revision + 1,
      attributes: { ...employee.attributes, employeeCode: "OTHER" },
    },
  ])
  await expectRejected(
    f.change(1, {
      operation: "decide",
      action: "approve",
      target: await f.target(),
      expected_revision: 2,
      reason: "資格喪失後の判断",
    }),
  )
  await f.database
    .prepare(
      "DELETE FROM system_iam_role_permissions WHERE permission_key = 'performance_review:write'",
    )
    .run()
  await expectRejected(
    new ReviewAccessAdapter(f.context(0)).prepare("performance_review:write"),
    "permission_required",
  )
})

test("別コマンドの同時訂正は一方だけを保存し、履歴の版を飛ばさない", async () => {
  const f = await reviewFixture()
  const results = await Promise.allSettled([
    f.change(0, {
      operation: "revise_goals",
      goals: [{ ...f.goal, title: "訂正A" }],
      expected_revision: 1,
      reason: "A",
    }),
    f.change(0, {
      operation: "revise_goals",
      goals: [{ ...f.goal, title: "訂正B" }],
      expected_revision: 1,
      reason: "B",
    }),
  ])
  expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1)
  expect(results.filter((result) => result.status === "rejected")).toHaveLength(1)
  expect(await new ReviewSheetRepository(f.context(0)).history(f.sheet.id)).toHaveLength(2)
})

test("管理権限があっても本人の判断は拒否し、取消はSystem案件と一緒に確定する", async () => {
  const f = await reviewFixture()
  const role = crypto.randomUUID()
  await f.database
    .prepare(
      "INSERT INTO system_iam_roles (id, key, kind, name, created_at, updated_at) VALUES (?, 'custom:review-admin', 'custom', 'Review administrator', 0, 0)",
    )
    .bind(role)
    .run()
  await f.database
    .prepare(
      "INSERT INTO system_iam_role_permissions (role_id, permission_key) VALUES (?, 'system:admin')",
    )
    .bind(role)
    .run()
  await f.database
    .prepare(
      "INSERT INTO system_role_bindings (id, account_id, role_id, created_at) VALUES (?, ?, ?, 0)",
    )
    .bind(crypto.randomUUID(), f.creator.accountId, role)
    .run()
  await f.change(0, { operation: "submit_goals", expected_revision: 1, reason: "提出" })
  await expectRejected(
    f.change(0, {
      operation: "decide",
      action: "approve",
      target: await f.target(),
      expected_revision: 2,
      reason: "管理者の自己承認",
    }),
  )
  const cancelled = await f.change(0, {
    operation: "cancel",
    expected_revision: 2,
    reason: "本人の取消",
  })
  expect(cancelled.status).toBe("cancelled")
  expect(
    await f.database
      .prepare("SELECT status FROM system_cases WHERE id = ?")
      .bind(cancelled.approval!.case_id)
      .first<string>("status"),
  ).toBe("cancelled")
  await expectRejected(
    f.change(0, { operation: "submit_goals", expected_revision: 3, reason: "取消済みの再提出" }),
  )
})

test("承認後の目標改定は旧承認を履歴に保ち、新しい承認が揃うまで自己評価を許さない", async () => {
  const f = await reviewFixture()
  await f.change(0, { operation: "submit_goals", expected_revision: 1, reason: "提出" })
  await f.change(1, {
    operation: "decide",
    action: "approve",
    expected_revision: 2,
    target: await f.target(),
    reason: "確認",
  })
  const approved = await f.change(2, {
    operation: "decide",
    action: "approve",
    expected_revision: 3,
    target: await f.target(),
    reason: "確認",
  })
  const draft = await f.change(0, {
    operation: "reopen_goals",
    expected_revision: 4,
    reason: "状況変更に伴う改定",
  })
  expect(draft.approval).toBeNull()
  await expectRejected(
    f.change(0, {
      operation: "self_evaluate",
      expected_revision: 5,
      assessments: [
        { goal_id: f.goal.id, actual: "旧内容の実績", score: 3, comment: "旧承認を流用" },
      ],
      reason: "評価",
    }),
  )
  await f.change(0, {
    operation: "revise_goals",
    expected_revision: 5,
    goals: [{ ...f.goal, title: "改定した目標" }],
    reason: "目標を改定",
  })
  const resubmitted = await f.change(0, {
    operation: "submit_goals",
    expected_revision: 6,
    reason: "再承認を依頼",
  })
  expect(resubmitted.approval!.proposal_id).not.toBe(approved.approval!.proposal_id)
  expect(
    await f.database
      .prepare("SELECT status FROM system_cases WHERE id = ?")
      .bind(approved.approval!.case_id)
      .first<string>("status"),
  ).toBe("approved")
})

async function expectRejected(value: Promise<unknown>, expected?: string) {
  await rejects(
    value,
    (error: unknown) =>
      error instanceof Error && (expected === undefined || error.message.includes(expected)),
  )
}
