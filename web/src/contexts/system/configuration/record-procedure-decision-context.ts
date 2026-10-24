import type { SystemClockContext, SystemD1Context } from "@system/configuration/system-context"
import type { SystemProposalView } from "@system/domain/definitions/workflow/system-proposal-view.definition"
import type { ApproveSystemTaskCommand } from "@system/application/workflow/approve-system-task"
import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"

/** 人間の判断資格は外部で解決し、Systemは固定した対象に対する判断を保存する。 */
export type RecordProcedureDecisionContext = SystemD1Context &
  SystemClockContext &
  Readonly<{
    prepareDecision: (
      input: Readonly<{
        proposal: SystemProposalView
        decisionTarget: Readonly<{
          proposalVersion: number
          proposalDigest: string
          taskKey: string
          taskRound: number
        }>
        actorAccountId: AccountId
        action: "approve" | "reject"
        decidedAt: Date
      }>,
    ) => Promise<
      | (Omit<ApproveSystemTaskCommand, "comment" | "decidedAt"> &
          Readonly<{
            action: "approve" | "reject" | "return"
            guards: ReadonlyArray<D1PreparedStatement>
          }>)
      | Error
    >
  }>
