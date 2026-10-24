import type { ApplicationWorkflowStep } from "@/contexts/company/domain/definitions/company-procedure-workflow.definition"
import { SystemD1ProposalAdapter } from "@system/infrastructure/adapters/workflow/system-d1-proposal.adapter"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { testAccountId, testLiteralId } from "@system/test/system-test-id.test-support"
import { expect, setDefaultTimeout, test } from "bun:test"
import { createGovernanceTaskTestContext } from "@/contexts/company/test/governance-task.test-support"
import { RevalidateRecordPreservationExecutionAdapter } from "@/contexts/company/infrastructure/adapters/organization/revalidate-record-preservation-execution.adapter"
import { PrepareCompanyRecordProcedureTaskAdapter } from "@/contexts/company/infrastructure/adapters/organization/prepare-company-record-procedure-task.adapter"
import { createCompanyProcedureDecisionPolicy } from "@/contexts/company/domain/policies/company-procedure-decision.policy"
import { RecordPreservationProposalValue } from "@system/domain/values/records/record-preservation-proposal.value"
import { ProcedureDefinitionEntity } from "@system/domain/entities/procedure-definition.entity"
import { SystemD1ProcedureRepository } from "@system/infrastructure/repositories/workflow/system-d1-procedure.repository"
import {
  StartSystemProcedure,
  type StartSystemProcedureCommand,
} from "@system/application/workflow/start-system-procedure"
import { ApproveSystemTask } from "@system/application/workflow/approve-system-task"
import { SystemD1WorkflowAdapter } from "@system/infrastructure/adapters/workflow/system-d1-workflow.adapter"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

test.each(["approver", "service"])(
  "record preservation revalidates Company approval independently of executor: %s",
  async (executorKind) => {
    const c = await createGovernanceTaskTestContext()
    const reviewer = c.people[1]
    const assignment = c.resources.find((resource) => resource.type === "responsibility-assignment")
    if (reviewer === undefined || assignment === undefined)
      throw new Error("missing reviewer fixture")
    const executorAccountId =
      executorKind === "service"
        ? zAccountId.parse("3c9d7e5f-1a2b-4c3d-8e4f-5a6b7c8d9e0f")
        : reviewer.accountId
    if (executorKind === "service") {
      await c.database
        .prepare(
          "INSERT INTO system_accounts(id,status,created_at,updated_at) VALUES (?1,'active',0,0)",
        )
        .bind(executorAccountId)
        .run()
      await c.database
        .prepare(
          "INSERT INTO system_principals(id,account_id,kind,name,revision,created_at,updated_at) VALUES ('7b6f98fd-b1b2-4d49-9243-abe80daa23d1',?1,'service','Archive service',1,0,0)",
        )
        .bind(executorAccountId)
        .run()
    }
    const assigned = {
      ...assignment,
      revision: 2,
      attributes: {
        ...assignment.attributes,
        holderType: "employee",
        holderId: reviewer.employeeId,
        authorityScopeId: null,
      },
    }
    await c.write([assigned])
    const step: ApplicationWorkflowStep = {
      ...c.step,
      governance_authority: {
        organization_id: COMPANY_DEFAULT_ORGANIZATION_ID,
        responsibility_code: "APPROVE",
        scope: null,
      },
    }
    const policy = createCompanyProcedureDecisionPolicy({
      approverRoles: [],
      workflow: { version: 1, steps: [step] },
    })
    if (policy instanceof Error) throw policy
    const definition = ProcedureDefinitionEntity.create({
      key: "record-preservation",
      revision: 1,
      title: "Preserve original records",
      category: "system",
      description: null,
      inputSchema: { fields: [] },
      decisionPolicy: policy,
      completionOperationKey: "system.record.preserve",
      createdByAccountId: c.creator.accountId,
      createdAt: c.at,
    })
    if (definition instanceof Error) throw definition
    const proposal = await RecordPreservationProposalValue.restore({
      version: 1,
      operation: "system.record.preserve",
      recordId: crypto.randomUUID(),
      source: {
        sourceNamespace: "sample-source",
        ownerContext: "sample-records",
        recordKind: "record",
        recordId: "original-1",
        formatId: "sample-record",
        formatVersion: 1,
        sourceRevision: null,
        sourceRecordedAt: null,
        capturedAt: c.at.toISOString(),
        contentDigest: "a".repeat(64),
      },
      actorAccountId: executorAccountId,
      reason: "Preserve original",
      attachmentId: crypto.randomUUID(),
      attachmentDigest: "b".repeat(64),
      sourceAuthorizationRef: {
        context: "sample-records",
        kind: "export-grant",
        id: "grant-1",
        version: "1",
      },
      preservation: {
        id: crypto.randomUUID(),
        kind: "hold",
        retainUntil: null,
        reason: "Preserve original",
      },
      disclosure: {
        id: crypto.randomUUID(),
        revision: 1,
        reason: "Restricted archive",
        grants: [],
      },
    })
    if (proposal instanceof Error) throw proposal
    const body = JSON.parse(proposal.props.canonical.toString())
    const taskAdapter = new PrepareCompanyRecordProcedureTaskAdapter(c.context)
    const taskInput = {
      procedureKey: definition.key,
      proposal,
      applicantAccountId: c.creator.accountId,
      at: c.at,
    }
    expect(await taskAdapter.prepare(taskInput)).toBeInstanceOf(Error)
    const published = await new SystemD1ProcedureRepository(c.context).publish(definition, 0)
    if (published !== true) throw published
    expect(await taskAdapter.prepare({ ...taskInput, at: new Date(NaN) })).toBeInstanceOf(Error)
    const unrelated = ProcedureDefinitionEntity.create({
      key: "unrelated-procedure",
      revision: 1,
      title: "Unrelated procedure",
      category: "system",
      description: null,
      inputSchema: { fields: [] },
      decisionPolicy: policy,
      completionOperationKey: null,
      createdByAccountId: c.creator.accountId,
      createdAt: c.at,
    })
    if (unrelated instanceof Error) throw unrelated
    const unrelatedPublished = await new SystemD1ProcedureRepository(c.context).publish(
      unrelated,
      0,
    )
    if (unrelatedPublished !== true) throw unrelatedPublished
    expect(await taskAdapter.prepare({ ...taskInput, procedureKey: unrelated.key })).toBeInstanceOf(
      Error,
    )
    expect(
      await taskAdapter.prepare({
        ...taskInput,
        applicantAccountId: zAccountId.parse(testAccountId("unlinked-applicant")),
      }),
    ).toBeInstanceOf(Error)
    const hiddenDatabaseContext = {
      ...c.context,
      env: Object.defineProperty({ ...c.context.env }, "DB", {
        value: c.database,
        enumerable: false,
      }),
    }
    expect(
      await new PrepareCompanyRecordProcedureTaskAdapter(hiddenDatabaseContext).prepare(taskInput),
    ).not.toBeInstanceOf(Error)
    const preparedTask = await taskAdapter.prepare(taskInput)
    if (preparedTask instanceof Error) throw preparedTask
    expect(preparedTask.applicant.id).toBe(c.creator.employeeId)
    const resolved = preparedTask.resolved
    expect(
      await c.database
        .batch([
          c.database
            .prepare("UPDATE company_employees SET employee_code='CHANGED' WHERE id=?1")
            .bind(c.creator.employeeId),
          ...resolved.guards,
        ])
        .catch((cause: unknown) => cause),
    ).toBeInstanceOf(Error)
    expect(preparedTask.definition.completionOperationKey).toBe("system.record.preserve")
    expect(resolved.task.candidates.map((candidate) => candidate.accountId)).toEqual([
      reviewer.accountId,
    ])
    const writer = new SystemD1WorkflowAdapter({
      ...c.context,
      startGuards: resolved.guards,
    })
    const startCommand: StartSystemProcedureCommand = {
      seriesId: crypto.randomUUID(),
      version: 1,
      procedureKey: definition.key,
      procedureRevision: 1,
      body,
      createdByAccountId: c.creator.accountId,
      supersedesProposalId: null,
      createdAt: c.at,
      firstTask: resolved.task,
      subject: { context: "system", kind: "record-preservation", id: body.recordId, version: "1" },
    }
    const started = await new StartSystemProcedure({ writer }).run(startCommand)
    if (started instanceof Error) throw started
    const query = new SystemD1ProposalAdapter({
      ...c.context,
      visibleCompletionOperationKeys: ["system.record.preserve"],
    })
    const lookup = {
      seriesId: started.proposal.seriesId,
      version: 1,
      creatorAccountId: c.creator.accountId,
    }
    const replay = await query.findBySeriesVersion(lookup)
    if (replay instanceof Error || replay === null) throw new Error("missing submitted proposal")
    expect(replay.number).toBe(started.number)
    expect(replay.digest).toBe(started.proposal.digest)
    const replayIntent = await RecordPreservationProposalValue.restore(JSON.parse(replay.bodyJson))
    if (replayIntent instanceof Error) throw replayIntent
    const originalRequest = {
      reason: body.reason,
      preservation: {
        kind: body.preservation.kind,
        retainUntil: body.preservation.retainUntil,
        reason: body.preservation.reason,
      },
      disclosure: { reason: body.disclosure.reason, grants: body.disclosure.grants },
    }
    expect(replayIntent.matchesRequest(originalRequest)).toBe(true)
    expect(replayIntent.matchesRequest({ ...originalRequest, reason: "Changed on retry" })).toBe(
      false,
    )
    expect(
      await query.findBySeriesVersion({ ...lookup, creatorAccountId: reviewer.accountId }),
    ).toBeNull()
    expect(await query.findBySeriesVersion({ ...lookup, version: 2 })).toBeNull()
    expect(await query.findBySeriesVersion({ ...lookup, version: 0 })).toBeInstanceOf(Error)
    expect(
      await new SystemD1ProposalAdapter({
        ...c.context,
        visibleCompletionOperationKeys: [null],
      }).findBySeriesVersion(lookup),
    ).toBeNull()
    const validator = new RevalidateRecordPreservationExecutionAdapter(c.context)
    const input = {
      applicationId: started.number,
      caseId: started.workflowCase.id,
      seriesId: started.proposal.seriesId,
      proposal,
      executorAccountId,
      executedAt: c.at,
    }
    expect(await validator.prepare(input)).toBeInstanceOf(Error)
    const approved = await new ApproveSystemTask(writer).execute({
      caseId: started.workflowCase.id,
      taskKey: step.key,
      round: 1,
      actorAccountId: reviewer.accountId,
      representedAccountId: reviewer.accountId,
      delegationId: null,
      proposalDigest: started.proposal.digest,
      comment: null,
      decidedAt: c.at,
      nextTask: null,
    })
    if (approved instanceof Error) throw approved
    const guards = await validator.prepare(input)
    if (guards instanceof Error) throw guards
    await c.database.batch([...guards])
    const changed = await RecordPreservationProposalValue.restore({
      ...body,
      reason: "Different request",
    })
    if (changed instanceof Error) throw changed
    expect(await validator.prepare({ ...input, proposal: changed })).toBeInstanceOf(Error)
    expect(
      await validator.prepare({ ...input, caseId: testLiteralId("other-case") }),
    ).toBeInstanceOf(Error)
    await c.write([{ ...assigned, revision: 3, state: "void" }])
    expect(await c.database.batch([...guards]).catch((cause: unknown) => cause)).toBeInstanceOf(
      Error,
    )
    expect(await validator.prepare(input)).toBeInstanceOf(Error)
    expect(await taskAdapter.prepare(taskInput)).toBeInstanceOf(Error)
    const countSql = `SELECT
      (SELECT count(*) FROM system_proposals) AS proposals,
      (SELECT count(*) FROM system_cases) AS cases,
      (SELECT count(*) FROM system_decision_tasks) AS tasks`
    const beforeFailedStart = await c.database
      .prepare(countSql)
      .first<Readonly<Record<string, number>>>()
    expect(
      await new StartSystemProcedure({ writer }).run({
        ...startCommand,
        seriesId: crypto.randomUUID(),
      }),
    ).toBeInstanceOf(Error)
    expect(await c.database.prepare(countSql).first<Readonly<Record<string, number>>>()).toEqual(
      beforeFailedStart,
    )
    expect(
      await c.database.batch([...resolved.guards]).catch((cause: unknown) => cause),
    ).toBeInstanceOf(Error)
  },
)
