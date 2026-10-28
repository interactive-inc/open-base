import type {
  ReviewContext,
  ReviewCommand,
} from "@/contexts/performance-review/configuration/review-context"
import {
  ReviewSheetEntity,
  type ReviewPhase,
  type ReviewAssessment,
} from "@/contexts/performance-review/domain/entities/review-sheet.entity"
import type { ReviewCycleEntity } from "@/contexts/performance-review/domain/entities/review-cycle.entity"
import { ReviewError } from "@/contexts/performance-review/domain/errors"
import { ReviewSheetRepository } from "@/contexts/performance-review/infrastructure/repositories/review-sheet.repository"
import { ReviewCycleRepository } from "@/contexts/performance-review/infrastructure/repositories/review-cycle.repository"
import {
  REVIEW_COMPLETION_KEYS,
  ReviewAccessAdapter,
} from "@/contexts/performance-review/infrastructure/adapters/review-access.adapter"
import { openSystemProcedures } from "@system/interface/operations/open-system-procedures"
import { openSystemProposals } from "@system/interface/operations/open-system-proposals"
import { openSystemWorkflow } from "@system/interface/operations/open-system-workflow"
import { ProcedureDefinitionEntity } from "@system/domain/entities/procedure-definition.entity"
import { StartSystemProcedure } from "@system/application/workflow/start-system-procedure"
import { ApproveSystemTask } from "@system/application/workflow/approve-system-task"
import { RejectSystemTask } from "@system/application/workflow/reject-system-task"
import { ReturnSystemTask } from "@system/application/workflow/return-system-task"
import { CancelSystemProcedure } from "@system/application/workflow/cancel-system-procedure"
import { procedureKeySchema } from "@system/domain/schemas/workflow/procedure-key.schema"
import { createCompanyProcedureDecisionPolicy } from "@/contexts/company/domain/policies/company-procedure-decision.policy"
import { parseCompanyProcedureDecisionPolicy } from "@/contexts/company/domain/policies/parse-company-procedure-decision.policy"
import { zApplicationWorkflow } from "@/contexts/company/domain/definitions/company-procedure-workflow.definition"
import { openCompanyEmployeeDirectory } from "@/contexts/company/interface/operations/open-company-employee-directory"
import { resolveCompanyProcedureTask } from "@/contexts/company/interface/operations/resolve-company-procedure-task"
import { prepareCompanyProcedureDecision } from "@/contexts/company/interface/operations/prepare-company-procedure-decision"
import { CompanyOperationError } from "@/contexts/company/domain/errors"

export type ReviewDecisionTarget = {
  proposal_version: number
  proposal_digest: string
  task_key: string
  task_round: number
}

/** 評価の正本とSystem案件を原子的に接続し、判断資格をCompanyへ委ねる。 */
export class ReviewWorkflowAdapter {
  constructor(private readonly c: ReviewContext) {}
  prepareCycle(cycle: ReviewCycleEntity, workflows: { goals: unknown; evaluation: unknown }) {
    const repository = openSystemProcedures(this.c)
    return (["goals", "evaluation"] as const).flatMap((phase) => {
      const workflow = zApplicationWorkflow.safeParse(workflows[phase])
      if (!workflow.success) throw new ReviewError(422, "invalid_approval_workflow")
      const policy = createCompanyProcedureDecisionPolicy({
        approverRoles: [],
        workflow: workflow.data,
      })
      if (policy instanceof Error) throw new ReviewError(422, "invalid_approval_policy")
      const definition = ProcedureDefinitionEntity.create({
        key:
          phase === "goals" ? cycle.data.goals_procedure_key : cycle.data.evaluation_procedure_key,
        revision: 1,
        title: `${cycle.data.name}: ${phase}`,
        category: "performance-review",
        description: null,
        inputSchema: { fields: [] },
        decisionPolicy: policy,
        completionOperationKey:
          phase === "goals" ? REVIEW_COMPLETION_KEYS[0] : REVIEW_COMPLETION_KEYS[1],
        createdByAccountId: this.c.actor.accountId,
        createdAt: new Date(cycle.data.created_at),
      })
      if (definition instanceof Error) throw new ReviewError(422, "invalid_review_procedure")
      return repository.preparePublishStatements(definition, 0)
    })
  }
  async submit(
    sheet: ReviewSheetEntity,
    phase: ReviewPhase,
    command: ReviewCommand,
    guards: ReadonlyArray<D1PreparedStatement>,
  ) {
    const next = sheet.submit(phase, this.c.now().toISOString()),
      repo = new ReviewSheetRepository(this.c)
    const cycle = await new ReviewCycleRepository(this.c).find(sheet.data.cycle_id)
    if (cycle === null) throw new ReviewError(404, "cycle_not_found")
    const key =
      phase === "goals" ? cycle.data.goals_procedure_key : cycle.data.evaluation_procedure_key
    const definition = await openSystemProcedures(this.c).find(procedureKeySchema.parse(key))
    if (definition instanceof Error || definition === null || definition.revision !== 1)
      throw new ReviewError(409, "review_procedure_changed")
    const policy = parseCompanyProcedureDecisionPolicy(JSON.parse(definition.decisionPolicyJson))
    if (policy instanceof Error) throw new ReviewError(422, "invalid_approval_policy")
    const applicant = await openCompanyEmployeeDirectory(this.c).findById(this.c.actor.employeeId)
    if (applicant instanceof Error || applicant?.employment?.status !== "ACTIVE")
      throw new ReviewError(403, "applicant_unavailable")
    const payload = {
      sheet_id: sheet.data.id,
      sheet_revision: next.data.revision,
      phase,
      evaluation_policy: sheet.data.evaluation_policy,
      goals: sheet.data.goals,
      self_assessments: phase === "evaluation" ? sheet.data.self_assessments : [],
    }
    const resolved = await resolveCompanyProcedureTask({
      c: this.c,
      policy,
      payload,
      applicant: {
        employeeId: applicant.id,
        employeeCode: applicant.employeeCode,
        employmentStatus: applicant.employment.status,
        organizationUnitId: applicant.primaryAssignment?.organizationUnitId ?? null,
        organizationUnitCode: applicant.primaryAssignment?.organizationUnitCode ?? null,
        organizationUnitName: applicant.primaryAssignment?.organizationUnitName ?? null,
        positionTitle: applicant.primaryAssignment?.positionTitle ?? null,
      },
      activatedAt: this.c.now(),
      afterTaskKey: null,
      excludedEmployeeIds: new Set([this.c.actor.employeeId]),
    })
    if (resolved instanceof Error || resolved === null)
      throw new ReviewError(422, "approval_authority_unresolvable", { cause: resolved })
    const writer = openSystemWorkflow({
      ...this.c,
      startGuards: [...guards, repo.guard(sheet.data.id, sheet.data.revision), ...resolved.guards],
    })
    const started = await new StartSystemProcedure({
      writer: {
        start: async (packet) => {
          try {
            const statements = writer.prepareStartStatements(packet)
            const approval = {
              number: 1,
              proposal_id: packet.proposal.id,
              case_id: packet.workflowCase.id,
              phase,
            }
            const saved = next.withApproval(approval)
            const results = await this.c.env.DB.batch<{ number: number }>([
              ...statements,
              ...repo.statements(saved, sheet.data.revision, command, {
                kind: "submission",
                seriesId: packet.proposal.seriesId,
              }),
              this.c.env.DB.prepare(
                "SELECT number FROM system_proposal_numbers WHERE series_id = ?",
              ).bind(packet.proposal.seriesId),
            ])
            return results.at(-1)?.results[0]?.number ?? new Error("proposal missing")
          } catch (cause) {
            return cause instanceof Error ? cause : new Error("review_submission_failed", { cause })
          }
        },
        decide: writer.decide.bind(writer),
        cancel: writer.cancel.bind(writer),
        reassign: writer.reassign.bind(writer),
      },
    }).run({
      seriesId: crypto.randomUUID(),
      version: 1,
      procedureKey: definition.key,
      procedureRevision: definition.revision,
      body: payload,
      createdByAccountId: this.c.actor.accountId,
      supersedesProposalId: null,
      createdAt: this.c.now(),
      firstTask: resolved.task,
      subject: {
        context: "performance-review",
        kind: "review-sheet",
        id: sheet.data.id,
        version: String(next.data.revision),
      },
    })
    if (started instanceof Error) {
      const replay = await repo.replay(command)
      if (replay !== null) {
        const current = await repo.find(sheet.data.id)
        if (current === null) throw new ReviewError(404, "sheet_not_found")
        const read = await new ReviewAccessAdapter(this.c).read(current)
        await repo.verify([...read.guards, repo.guard(current.data.id, current.data.revision)])
        return replay
      }
      throw new ReviewError(409, "review_submission_conflict")
    }
    const result = await repo.replay(command)
    if (result === null) throw new ReviewError(503, "sheet_unavailable")
    return result
  }
  async decide(
    sheet: ReviewSheetEntity,
    input: {
      action: "approve" | "reject" | "return"
      target: ReviewDecisionTarget
      assessments?: ReviewAssessment[]
    },
    command: ReviewCommand,
    guards: ReadonlyArray<D1PreparedStatement>,
  ) {
    const approval = sheet.data.approval,
      repo = new ReviewSheetRepository(this.c)
    if (approval === null || !["goals_pending", "evaluation_pending"].includes(sheet.data.status))
      throw new ReviewError(409, "sheet_not_pending")
    if (approval.phase === "evaluation" && input.action === "approve")
      sheet.validateAssessments(input.assessments ?? [])
    if (input.action !== "approve" && input.assessments !== undefined)
      throw new ReviewError(422, "assessments_not_expected")
    if (approval.phase === "goals" && input.assessments !== undefined)
      throw new ReviewError(422, "assessments_not_expected")
    const proposal = await openSystemProposals({
      ...this.c,
      visibleCompletionOperationKeys: [...REVIEW_COMPLETION_KEYS],
    }).findByNumber(approval.number)
    if (
      proposal instanceof Error ||
      proposal === null ||
      proposal.proposalId !== approval.proposal_id
    )
      throw new ReviewError(409, "proposal_changed")
    const prepared = await prepareCompanyProcedureDecision(this.c, {
      proposal,
      decisionTarget: {
        proposalVersion: input.target.proposal_version,
        proposalDigest: input.target.proposal_digest,
        taskKey: input.target.task_key,
        taskRound: input.target.task_round,
      },
      actorAccountId: this.c.actor.accountId,
      actorEmployeeId: this.c.actor.employeeId,
      subjectEmployeeId: sheet.data.employee_id as typeof this.c.actor.employeeId,
      targetDepartmentCode: null,
      excludedEmployeeIds: new Set([sheet.data.employee_id as typeof this.c.actor.employeeId]),
      action: input.action === "approve" ? "approve" : "reject",
      decidedAt: this.c.now(),
    })
    if (prepared instanceof CompanyOperationError)
      throw new ReviewError(
        prepared.code === "decision_target_changed" ? 409 : 403,
        "decision_not_authorized",
      )
    if (prepared.action !== input.action)
      throw new ReviewError(422, "decision_action_does_not_match_workflow")
    const now = this.c.now().toISOString()
    // Systemが算出した案件の状態を、同じbatch内の評価snapshotへ反映する。
    const next = sheet.decide("pending", now)
    const effects = repo.statements(
      next,
      sheet.data.revision,
      {
        ...command,
        detail: {
          ...input,
          represented_account_id: prepared.representedAccountId,
          delegation_id: prepared.delegationId,
          ...(approval.phase === "evaluation" && input.action === "approve"
            ? { evaluation_summary: sheet.summarizeAssessments(input.assessments ?? []) }
            : {}),
        },
      },
      { kind: "decision", caseId: approval.case_id, phase: approval.phase },
    )
    const writer = openSystemWorkflow({
      ...this.c,
      decisionGuards: [
        ...guards,
        repo.guard(sheet.data.id, sheet.data.revision),
        ...prepared.guards,
      ],
      decisionEffects: effects,
    })
    const Service =
      input.action === "approve"
        ? ApproveSystemTask
        : input.action === "return"
          ? ReturnSystemTask
          : RejectSystemTask
    const result = await new Service(writer).execute({
      ...prepared,
      comment: command.reason,
      decidedAt: this.c.now(),
    })
    if (result instanceof Error) {
      const replay = await repo.replay(command)
      if (replay !== null) {
        const current = await repo.find(sheet.data.id)
        if (current === null) throw new ReviewError(404, "sheet_not_found")
        const read = await new ReviewAccessAdapter(this.c).read(current)
        await repo.verify([...read.guards, repo.guard(current.data.id, current.data.revision)])
        return replay
      }
      throw new ReviewError(409, "review_decision_conflict")
    }
    const saved = await repo.replay(command)
    if (saved === null) throw new ReviewError(503, "sheet_unavailable")
    return saved
  }
  async cancel(
    sheet: ReviewSheetEntity,
    command: ReviewCommand,
    guards: ReadonlyArray<D1PreparedStatement>,
  ) {
    const next = sheet.cancel(this.c.now().toISOString()),
      repo = new ReviewSheetRepository(this.c)
    if (
      !["goals_pending", "evaluation_pending"].includes(sheet.data.status) ||
      sheet.data.approval === null
    )
      return repo.save(next, sheet.data.revision, command, guards)
    const writer = openSystemWorkflow({
      ...this.c,
      cancelGuards: [...guards, repo.guard(sheet.data.id, sheet.data.revision)],
      cancelEffects: repo.statements(next, sheet.data.revision, command),
    })
    const result = await new CancelSystemProcedure(writer).run({
      number: sheet.data.approval.number,
      createdByAccountId: this.c.actor.accountId,
      cancelledAt: this.c.now(),
    })
    if (result !== true) {
      const replay = await repo.replay(command)
      if (replay !== null) {
        const current = await repo.find(sheet.data.id)
        if (current === null) throw new ReviewError(404, "sheet_not_found")
        const read = await new ReviewAccessAdapter(this.c).read(current)
        await repo.verify([...read.guards, repo.guard(current.data.id, current.data.revision)])
        return replay
      }
      throw new ReviewError(409, "review_cancellation_conflict")
    }
    return next.data
  }
}
