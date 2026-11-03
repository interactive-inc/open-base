import { SystemTaskApprovalGuardAdapter } from "@system/infrastructure/adapters/workflow/system-task-approval-guard.adapter"
import { afterEach, expect, spyOn, test } from "bun:test"
import { readFileSync } from "node:fs"
import { createLocalD1Database } from "@system/test/local-d1/create-local-d1-database.test-support"
import { createRetirementDecisionProposal } from "@system/test/create-retirement-decision-proposal.test-support"
import { RecordRetirementProposalValue } from "@system/domain/values/records/record-retirement-proposal.value"
import { DecideRecordRetirementAdapter } from "@system/infrastructure/adapters/records/decide-record-retirement.adapter"
import { PrepareRecordRetirementRetentionAdapter } from "@system/infrastructure/adapters/records/prepare-record-retirement-retention.adapter"
import { PrepareRecordRetirementSourceAttachmentsAdapter } from "@system/infrastructure/adapters/records/prepare-record-retirement-source-attachments.adapter"
import { PrepareRecordRetirementStorageKeysAdapter } from "@system/infrastructure/adapters/records/prepare-record-retirement-storage-keys.adapter"
import { PrepareSystemReadAuthorizationAdapter } from "@system/infrastructure/adapters/iam/prepare-system-read-authorization.adapter"
import { PrepareSystemCaseReadGuardAdapter } from "@system/infrastructure/adapters/workflow/prepare-system-case-read-guard.adapter"
import { SystemD1WorkflowAdapter } from "@system/infrastructure/adapters/workflow/system-d1-workflow.adapter"
import { SystemD1ProposalAdapter } from "@system/infrastructure/adapters/workflow/system-d1-proposal.adapter"
import { StartSystemProcedure } from "@system/application/workflow/start-system-procedure"
import { ApproveSystemTask } from "@system/application/workflow/approve-system-task"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"

const restores: Array<() => void> = []
afterEach(() => {
  for (const restore of restores.splice(0).reverse()) restore()
})

async function fixture() {
  const schema = [
    "system-integration",
    "system-core",
    "system-principal",
    "system-workflow",
    "system-decision-policy",
    "system-procedure",
    "system-procedure-delegation",
  ]
    .map((name) =>
      readFileSync(new URL(`../infrastructure/schema/${name}.sql`, import.meta.url), "utf8"),
    )
    .join("\n")
  const db = await createLocalD1Database({ schema })
  const input = await createRetirementDecisionProposal()
  const value = await RecordRetirementProposalValue.create(input)
  if (value instanceof Error) throw value
  const at = new Date()
  const voters = Array.from({ length: 3 }, () => zAccountId.parse(crypto.randomUUID()))
  const applicant = zAccountId.parse(input.actorAccountId)
  for (const accountId of [applicant, ...voters]) {
    await db
      .prepare(
        "INSERT INTO system_accounts(id,status,token_version,created_at,updated_at) VALUES (?1,'active',0,0,0)",
      )
      .bind(accountId)
      .run()
    await db
      .prepare(
        "INSERT INTO system_principals(id,account_id,kind,name,revision,created_at,updated_at) VALUES (?1,?2,'human','Reviewer',1,0,0)",
      )
      .bind(crypto.randomUUID(), accountId)
      .run()
  }
  await db.exec(
    `INSERT INTO system_procedure_definitions(key,current_revision,status,created_at,updated_at) VALUES ('retire',1,'active',0,0)`,
  )
  await db
    .prepare(
      `INSERT INTO system_procedure_definition_revisions(procedure_key,revision,title,category,input_schema_json,decision_policy_json,completion_operation_key,created_by_account_id,created_at) VALUES ('retire',1,'Retire','records','{}','{}','system.record.retire',?1,0)`,
    )
    .bind(applicant)
    .run()
  await db.exec("INSERT INTO system_procedure_numbers(procedure_key) VALUES ('retire')")
  const context = { env: { DB: db }, var: { now: () => at } }
  const started = await new StartSystemProcedure({
    writer: new SystemD1WorkflowAdapter(context),
  }).run({
    seriesId: crypto.randomUUID(),
    version: 1,
    procedureKey: "retire",
    procedureRevision: 1,
    body: JSON.parse(value.props.canonical.toString()),
    createdByAccountId: applicant,
    supersedesProposalId: null,
    createdAt: at,
    firstTask: {
      key: "review",
      requiredApprovals: 2,
      requiredParticipants: 3,
      negativeDecisionRule: "approval-impossible",
      openedAt: at,
      dueAt: null,
      candidates: voters.map((accountId) => ({
        accountId,
        source: "primary",
        evidenceContext: "example",
        evidenceKind: "reviewer",
        evidenceId: accountId,
        evidenceVersion: "1",
        eligibilityDigest: value.props.digest.toString(),
        eligibleFrom: null,
        resolvedAt: at,
      })),
      excludedAccountIds: [],
    },
  })
  if (started instanceof Error) throw started
  const query = new SystemD1ProposalAdapter(context)
  const command = (accountId: typeof applicant) => ({
    caseId: started.workflowCase.id,
    taskKey: "review",
    round: 1,
    actorAccountId: accountId,
    representedAccountId: accountId,
    delegationId: null,
    proposalDigest: started.proposal.digest,
    nextTask: null,
    comment: null,
    decidedAt: at,
  })
  const approve = async (index: number) => {
    const voter = voters[index]
    if (voter === undefined) throw new Error("voter missing")
    return new ApproveSystemTask(new SystemD1WorkflowAdapter(context)).execute(command(voter))
  }
  const auth = spyOn(PrepareSystemReadAuthorizationAdapter.prototype, "prepare").mockResolvedValue({
    permissionKeys: new Set(["system:procedure:read"]),
    assertions: () => [db.prepare("SELECT 1")],
  })
  const read = spyOn(PrepareSystemCaseReadGuardAdapter.prototype, "prepare").mockResolvedValue(() =>
    db.prepare("SELECT 1"),
  )
  restores.push(
    () => auth.mockRestore(),
    () => read.mockRestore(),
  )
  const reject = async (beforeSave?: () => Promise<void>) => {
    const voter = voters[2]
    if (voter === undefined) throw new Error("voter missing")
    if (beforeSave !== undefined) {
      const original = SystemD1WorkflowAdapter.prototype.decide
      const saving = spyOn(SystemD1WorkflowAdapter.prototype, "decide").mockImplementationOnce(
        async function (this: SystemD1WorkflowAdapter, input) {
          saving.mockRestore()
          await beforeSave()
          return original.call(this, input)
        },
      )
      restores.push(() => saving.mockRestore())
    }
    return new DecideRecordRetirementAdapter({
      ...context,
      source: {
        planId: input.plan.snapshot.id,
        ownerContext: "example",
        sourceNamespace: "example-source",
      },
      prepareReplay: async () => ({ guards: [db.prepare("SELECT 1")] }),
      prepareDecision: async () => {
        return { ...command(voter), action: "reject", guards: [db.prepare("SELECT 1")] }
      },
    }).execute({
      authentication: {
        accountId: voter,
        tokenVersion: 0,
        issuedAtMs: 0,
        expiresAtMs: at.getTime() + 60000,
        machineCredentialId: null,
        identityBindingId: null,
        sessionFamilyId: null,
      },
      number: started.number,
      action: "reject",
      body: {
        decision_target: {
          proposal_version: 1,
          proposal_digest: started.proposal.digest,
          task_key: "review",
          task_round: 1,
        },
        comment: null,
      },
    })
  }
  const coverage = {
    planId: input.plan.snapshot.id,
    planDigest: input.plan.digest,
    totalPages: input.plan.totalPages,
    terminalReceiptId: input.terminalReceipt.snapshot.id,
    terminalReceiptDigest: input.terminalReceipt.digest,
    checkedThrough: input.terminalReceipt.snapshot.checkedAt,
    assertions: [db.prepare("SELECT 1")],
  }
  const retention = spyOn(
    PrepareRecordRetirementRetentionAdapter.prototype,
    "prepare",
  ).mockResolvedValue({ coverage, assertions: [db.prepare("SELECT 1")] })
  const originals = spyOn(
    PrepareRecordRetirementSourceAttachmentsAdapter.prototype,
    "prepare",
  ).mockResolvedValue({ coverage, assertions: [db.prepare("SELECT 1")] })
  const keys = spyOn(
    PrepareRecordRetirementStorageKeysAdapter.prototype,
    "prepare",
  ).mockResolvedValue({ coverage, assertions: [db.prepare("SELECT 1")] })
  restores.push(
    () => retention.mockRestore(),
    () => originals.mockRestore(),
    () => keys.mockRestore(),
  )
  return { db, query, started, approve, reject, coverage, checks: { retention, originals, keys } }
}

test.each(["retention", "originals", "keys"] as const)(
  "最後の反対票でも安全確認の失敗で承認と票を巻き戻す: %s",
  async (check) => {
    const c = await fixture()
    await c.approve(0)
    await c.approve(1)
    c.checks[check].mockResolvedValue(new Error("safety unavailable"))
    expect(await c.reject()).toBeInstanceOf(Error)
    expect(await c.query.listAttestations(c.started.workflowCase.id)).toHaveLength(2)
    const proposal = await c.query.findByNumber(c.started.number)
    if (proposal instanceof Error || proposal === null) throw proposal
    expect(proposal.status).toBe("pending")
  },
)

test.each(["retention", "originals", "keys"] as const)(
  "承認を成立させた反対票の再送でも安全確認を通す: %s",
  async (check) => {
    const c = await fixture()
    await c.approve(0)
    await c.approve(1)
    expect(await c.reject()).toEqual({ status: "approved" })
    c.checks[check].mockResolvedValue(new Error("safety unavailable"))
    expect(await c.reject()).toBeInstanceOf(Error)
    expect(await c.query.listAttestations(c.started.workflowCase.id)).toHaveLength(3)
  },
)

test("反対票の準備中に賛成が増えても一括書き込みの安全確認を省かない", async () => {
  const c = await fixture()
  await c.approve(0)
  const failure = [c.db.prepare("SELECT json_extract('{}','safety_changed')")]
  c.checks.retention.mockResolvedValue({ coverage: c.coverage, assertions: failure })
  expect(
    await c.reject(async () => {
      await c.approve(1)
    }),
  ).toBeInstanceOf(Error)
  expect(await c.query.listAttestations(c.started.workflowCase.id)).toHaveLength(2)
  const proposal = await c.query.findByNumber(c.started.number)
  if (proposal instanceof Error || proposal === null) throw proposal
  expect(proposal.status).toBe("pending")
})

test("安全確認を準備できなくても保留の反対票は保存する", async () => {
  const c = await fixture()
  c.checks.retention.mockResolvedValue(new Error("safety unavailable"))
  expect(await c.reject()).toEqual({ status: "pending" })
  expect(await c.query.listAttestations(c.started.workflowCase.id)).toHaveLength(1)
})

test.each(["retention", "originals", "keys"] as const)(
  "安全確認の保存時の失敗も、反対票と承認をまとめて巻き戻す: %s",
  async (check) => {
    const c = await fixture()
    await c.approve(0)
    const guard = new SystemTaskApprovalGuardAdapter({
      env: { DB: c.db },
      approvalTask: {
        caseId: c.started.workflowCase.id,
        taskKey: "review",
        round: 1,
      },
    }).prepare(
      "WITH target AS (SELECT ?1 AS value) SELECT CASE WHEN value = ?2 THEN 1 ELSE json_extract('{}','safety_changed') END FROM target",
      [1, 2],
    )
    c.checks[check].mockResolvedValue({ coverage: c.coverage, assertions: [guard] })
    expect(
      await c.reject(async () => {
        await c.approve(1)
      }),
    ).toBeInstanceOf(Error)
    expect(await c.query.listAttestations(c.started.workflowCase.id)).toHaveLength(2)
    const tasks = await c.query.listTasks(c.started.workflowCase.id)
    if (tasks instanceof Error) throw tasks
    expect(tasks[0]?.outcome).toBe("pending")
  },
)

test("承認時だけの検査は未成立の反対票と再送を妨げない", async () => {
  const c = await fixture()
  const guard = new SystemTaskApprovalGuardAdapter({
    env: { DB: c.db },
    approvalTask: {
      caseId: c.started.workflowCase.id,
      taskKey: "review",
      round: 1,
    },
  }).prepare("SELECT json_extract('{}','safety_changed')")
  c.checks.retention.mockResolvedValue({ coverage: c.coverage, assertions: [guard] })
  expect(await c.reject()).toEqual({ status: "pending" })
  expect(await c.reject()).toEqual({ status: "pending" })
  expect(await c.query.listAttestations(c.started.workflowCase.id)).toHaveLength(1)
})
