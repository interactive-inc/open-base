import { D1CompanyResourceRepository } from "@/contexts/company/infrastructure/repositories/core/d1-company-resource.repository"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"
import { createLocalD1Database } from "@system/test/local-d1/create-local-d1-database.test-support"
import { createGovernanceTaskTestContext } from "@/contexts/company/test/governance-task.test-support"
import type { ReviewContext } from "@/contexts/performance-review/configuration/review-context"
import { REVIEW_PERMISSION_KEYS } from "@/contexts/performance-review/domain/catalogs/review-permission.catalog"
import { CreateReviewCycle } from "@/contexts/performance-review/application/create-review-cycle"
import { CreateReviewSheet } from "@/contexts/performance-review/application/create-review-sheet"
import { ChangeReviewSheet } from "@/contexts/performance-review/application/change-review-sheet"
import { ReviewCycleRepository } from "@/contexts/performance-review/infrastructure/repositories/review-cycle.repository"
import { ReviewSheetRepository } from "@/contexts/performance-review/infrastructure/repositories/review-sheet.repository"
import {
  ReviewAccessAdapter,
  REVIEW_COMPLETION_KEYS,
} from "@/contexts/performance-review/infrastructure/adapters/review-access.adapter"
import { ReviewWorkflowAdapter } from "@/contexts/performance-review/infrastructure/adapters/review-workflow.adapter"
import type { ReviewSheetCommandInput } from "@/contexts/performance-review/domain/values/review-command.value"
import { CanonicalSystemJsonValue } from "@system/domain/values/audit/canonical-system-json.value"
import { ProposalDigestValue } from "@system/domain/values/workflow/proposal-digest.value"
import { openSystemProposals } from "@system/interface/operations/open-system-proposals"

export async function reviewFixture() {
  const fixture = await createGovernanceTaskTestContext(await createLocalD1Database())
  const employees = await new D1CompanyResourceRepository({ database: fixture.database }).findMany({
    organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
    types: ["employee"],
    ids: fixture.people.map((person) => person.employeeId),
  })
  if (!employees.ok) throw employees.cause
  await fixture.write(
    employees.resources.map((employee) => ({
      organizationId: employee.organizationId,
      type: employee.type,
      id: employee.id,
      state: employee.state,
      effectiveFrom: employee.effectiveFrom,
      effectiveTo: employee.effectiveTo,
      revision: employee.revision + 1,
      attributes: {
        ...employee.attributes,
        employeeCode: `R${fixture.people.findIndex((person) => person.employeeId === employee.id) + 1}`,
      },
    })),
  )
  const db = fixture.database,
    role = crypto.randomUUID()
  await db
    .prepare(
      "INSERT INTO system_iam_roles (id, key, kind, name, created_at, updated_at) VALUES (?, 'custom:review-test', 'custom', 'Review permissions', 0, 0)",
    )
    .bind(role)
    .run()
  await db.batch(
    REVIEW_PERMISSION_KEYS.filter((key) => key !== "performance_review:read:all").map((key) =>
      db
        .prepare("INSERT INTO system_iam_role_permissions (role_id, permission_key) VALUES (?, ?)")
        .bind(role, key),
    ),
  )
  await db.batch(
    fixture.people.map((person) =>
      db
        .prepare(
          "INSERT INTO system_role_bindings (id, account_id, role_id, created_at) VALUES (?, ?, ?, 0)",
        )
        .bind(crypto.randomUUID(), person.accountId, role),
    ),
  )
  const context = (index: number): ReviewContext => {
    const actor = fixture.people[index]
    if (actor === undefined) throw new Error("actor missing")
    return {
      ...fixture.context,
      actor: {
        ...actor,
        authentication: {
          accountId: actor.accountId,
          tokenVersion: 0,
          issuedAtMs: 0,
          expiresAtMs: Date.now() + 86400000,
          machineCredentialId: null,
          identityBindingId: null,
          sessionFamilyId: null,
        },
      },
      now: () => fixture.at,
    }
  }
  const command = async (
    operation: string,
    input: unknown,
    id: string,
    key = crypto.randomUUID(),
  ) => {
    const canonical = CanonicalSystemJsonValue.create({ operation, input, id })
    if (canonical instanceof Error) throw canonical
    const digest = await ProposalDigestValue.create(canonical)
    if (digest instanceof Error) throw digest
    return {
      idempotencyKey: key,
      digest: digest.toString(),
      reason: "確認した内容",
      operation,
      detail: input,
    }
  }
  const workflow = {
    version: 1 as const,
    steps: [
      {
        key: "review",
        name: "評価者の確認",
        approvers: [
          { type: "employee" as const, employee_code: "R2" },
          { type: "employee" as const, employee_code: "R3" },
        ],
        approval_mode: "all" as const,
        rejection_behavior: "return" as const,
      },
    ],
  }
  const actor = context(0)
  const input = {
    id: crypto.randomUUID(),
    name: "評価期間",
    starts_on: "2026-01-01",
    ends_on: "2026-12-31",
    goal_workflow: workflow,
    evaluation_workflow: workflow,
  }
  const cycleService = new CreateReviewCycle({
    repository: new ReviewCycleRepository(actor),
    access: new ReviewAccessAdapter(actor),
    workflow: new ReviewWorkflowAdapter(actor),
    accountId: actor.actor.accountId,
    now: actor.now,
  })
  const cycleCommand = await command("create_cycle", input, input.id)
  const cycle = await cycleService.run(input, cycleCommand)
  const goal = { id: crypto.randomUUID(), title: "目標", success_criteria: "完了条件", weight: 100 }
  const sheetInput = { id: crypto.randomUUID(), cycle_id: cycle.id, goals: [goal] }
  const sheet = await new CreateReviewSheet({
    repository: new ReviewSheetRepository(actor),
    cycles: new ReviewCycleRepository(actor),
    access: new ReviewAccessAdapter(actor),
    accountId: actor.actor.accountId,
    employeeId: actor.actor.employeeId,
    now: actor.now,
  }).run(sheetInput, await command("create_sheet", sheetInput, sheetInput.id))
  const change = async (
    index: number,
    input: ReviewSheetCommandInput,
    key = crypto.randomUUID(),
  ) => {
    const actor = context(index)
    return new ChangeReviewSheet({
      repository: new ReviewSheetRepository(actor),
      access: new ReviewAccessAdapter(actor),
      workflow: new ReviewWorkflowAdapter(actor),
      accountId: actor.actor.accountId,
      now: actor.now,
    }).run(sheet.id, input, await command(input.operation, input, sheet.id, key))
  }
  const target = async () => {
    const current = await new ReviewSheetRepository(actor).find(sheet.id)
    if (!current?.data.approval) throw new Error("approval missing")
    const proposal = await openSystemProposals({
      ...actor,
      visibleCompletionOperationKeys: [...REVIEW_COMPLETION_KEYS],
    }).findByNumber(current.data.approval.number)
    if (proposal === null || proposal instanceof Error) throw new Error("proposal missing")
    return {
      proposal_version: proposal.version,
      proposal_digest: proposal.digest,
      task_key: proposal.currentTaskKey!,
      task_round: proposal.currentTaskRound!,
    }
  }
  return {
    ...fixture,
    context,
    command,
    workflow,
    cycle,
    cycleService,
    cycleInput: input,
    cycleCommand,
    sheet,
    goal,
    change,
    target,
  }
}
