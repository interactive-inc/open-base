import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import {
  createSystemDecisionTask,
  type StartSystemProcedureTask,
} from "@system/domain/policies/decision-task.policy"
import { InvalidSystemProposalError } from "@system/domain/errors"
import { InvalidSystemWorkflowError } from "@system/domain/errors"
import { ProposalEntity } from "@system/domain/entities/proposal.entity"
import {
  createProposalId,
  type ProposalId,
} from "@system/domain/schemas/workflow/proposal-id.schema"
import type { SystemCaseReference } from "@system/domain/schemas/workflow/system-case-reference.schema"
import { SystemCaseEntity } from "@system/domain/entities/system-case.entity"
import {
  createSystemCaseId,
  type SystemCaseId,
} from "@system/domain/schemas/workflow/system-case.schema"
import type { SystemWorkflowWriter } from "@system/domain/definitions/workflow/system-workflow-writer.definition"

type Deps = Readonly<{
  createProposalId?: () => ProposalId
  createSystemCaseId?: () => SystemCaseId
}>

type Context = Readonly<{
  writer: SystemWorkflowWriter
  deps?: Deps
}>

export type StartSystemProcedureCommand = Readonly<{
  seriesId: string
  version: number
  procedureKey: string
  procedureRevision: number
  body: unknown
  createdByAccountId: AccountId
  supersedesProposalId: string | null
  createdAt: Date
  firstTask: StartSystemProcedureTask
  subject?: SystemCaseReference
}>

export type StartedSystemProcedure = Readonly<{
  number: number
  proposal: ProposalEntity
  workflowCase: SystemCaseEntity
}>

/** 提案、Case、最初の判断Taskを検証後に一つのSystem transactionで開始する。 */
export class StartSystemProcedure {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async run(
    command: StartSystemProcedureCommand,
  ): Promise<
    StartedSystemProcedure | InvalidSystemProposalError | InvalidSystemWorkflowError | Error
  > {
    const proposalId = (this.c.deps?.createProposalId ?? createProposalId)()
    const workflowCaseId = (this.c.deps?.createSystemCaseId ?? createSystemCaseId)()
    const proposal = await ProposalEntity.create({
      id: proposalId,
      seriesId: command.seriesId,
      version: command.version,
      procedureKey: command.procedureKey,
      procedureRevision: command.procedureRevision,
      body: command.body,
      createdByAccountId: command.createdByAccountId,
      supersedesProposalId: command.supersedesProposalId,
      createdAt: command.createdAt,
    })

    if (proposal instanceof InvalidSystemProposalError) return proposal

    const workflowCase = SystemCaseEntity.create({
      id: workflowCaseId,
      subject: command.subject ?? {
        context: "system",
        kind: "proposal",
        id: proposal.seriesId,
        version: String(proposal.version),
      },
      proposalDigest: proposal.digest,
      createdByAccountId: proposal.createdByAccountId,
      status: "pending",
      createdAt: command.createdAt,
      updatedAt: command.createdAt,
    })

    if (workflowCase instanceof InvalidSystemWorkflowError) return workflowCase

    const firstTask = createSystemDecisionTask({
      task: command.firstTask,
      caseId: workflowCase.id,
      createdByAccountId: workflowCase.createdByAccountId,
      proposalDigest: proposal.digest,
    })
    if (firstTask instanceof InvalidSystemWorkflowError) return firstTask
    if (firstTask.task.openedAt.getTime() < command.createdAt.getTime()) {
      return new InvalidSystemWorkflowError("invalid_chronology")
    }
    const persisted = await this.c.writer.start({
      proposal,
      workflowCase,
      firstTask,
    })

    return persisted instanceof Error ? persisted : { number: persisted, proposal, workflowCase }
  }
}
