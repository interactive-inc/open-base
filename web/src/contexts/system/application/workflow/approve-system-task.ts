import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import type {
  SystemWorkflowDecisionResult,
  SystemWorkflowWriter,
} from "@system/domain/definitions/workflow/system-workflow-writer.definition"
import type { SystemDecisionTaskBundle } from "@system/domain/definitions/workflow/system-decision-task-bundle.definition"
import { HumanAttestationEntity } from "@system/domain/entities/human-attestation.entity"
import { InvalidSystemWorkflowError } from "@system/domain/errors"
import type { ProposalDigest } from "@system/domain/schemas/workflow/system-case-reference.schema"
import type { SystemCaseId } from "@system/domain/schemas/workflow/system-case.schema"

export type ApproveSystemTaskCommand = Readonly<{
  caseId: SystemCaseId
  taskKey: string
  round: number
  actorAccountId: AccountId
  representedAccountId: AccountId
  delegationId: string | null
  proposalDigest: ProposalDigest
  comment: string | null
  decidedAt: Date
  nextTask: SystemDecisionTaskBundle | null
}>
type Context = SystemWorkflowWriter

/** Systemタスクを承認する。 */
export class ApproveSystemTask {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(
    command: ApproveSystemTaskCommand,
  ): Promise<SystemWorkflowDecisionResult | InvalidSystemWorkflowError | Error> {
    const attestation = HumanAttestationEntity.create({
      id: crypto.randomUUID(),
      caseId: command.caseId,
      taskKey: command.taskKey,
      round: command.round,
      actorAccountId: command.actorAccountId,
      representedAccountId: command.representedAccountId,
      delegationId: command.delegationId,
      action: "approve",
      proposalDigest: command.proposalDigest,
      comment: command.comment,
      decidedAt: command.decidedAt,
    })

    if (attestation instanceof InvalidSystemWorkflowError) return attestation

    return this.c.decide({
      attestation,
      decidedAt: command.decidedAt,
      nextTask: command.nextTask,
    })
  }
}
