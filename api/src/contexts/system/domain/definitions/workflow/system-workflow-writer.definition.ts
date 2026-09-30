import type { HumanAttestationEntity } from "@system/domain/entities/human-attestation.entity"
import type { ProposalEntity } from "@system/domain/entities/proposal.entity"
import type { SystemCaseEntity } from "@system/domain/entities/system-case.entity"
import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import type { SystemDecisionTaskBundle } from "@system/domain/definitions/workflow/system-decision-task-bundle.definition"

export type SystemWorkflowDecisionPersistence = Readonly<{
  attestation: HumanAttestationEntity
  decidedAt: Date
  nextTask: SystemDecisionTaskBundle | null
}>

export type SystemWorkflowDecisionResult = Readonly<{
  caseStatus: "pending" | "approved" | "rejected" | "returned"
  taskOutcome: "pending" | "approved" | "rejected" | "returned"
}>

/** 提案と判断lifecycleを原子的に永続化するSystem workflowの書込み口。 */
export type SystemWorkflowWriter = Readonly<{
  start(
    input: Readonly<{
      proposal: ProposalEntity
      workflowCase: SystemCaseEntity
      firstTask: SystemDecisionTaskBundle
    }>,
  ): Promise<number | Error>
  decide(input: SystemWorkflowDecisionPersistence): Promise<SystemWorkflowDecisionResult | Error>
  cancel(
    input: Readonly<{
      number: number
      createdByAccountId: AccountId
      cancelledAt: Date
    }>,
  ): Promise<true | "not_found" | "not_pending" | Error>
  reassign(
    input: Readonly<{
      caseId: string
      taskKey: string
      round: number
      reassignedAt: Date
      replacement: SystemDecisionTaskBundle
    }>,
  ): Promise<true | "not_pending" | Error>
}>
