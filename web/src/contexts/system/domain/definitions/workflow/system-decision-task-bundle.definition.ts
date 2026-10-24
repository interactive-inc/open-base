import type { DecisionTaskCandidateEntity } from "@system/domain/entities/decision-task-candidate.entity"
import type { DecisionTaskEntity } from "@system/domain/entities/decision-task.entity"
import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"

export type SystemDecisionTaskExclusion = Readonly<{
  accountId: AccountId
  reason: "creator" | "subject" | "policy"
}>

/** 一つの判断Taskと、その候補・除外根拠を同じ永続化境界へ渡すDomain snapshot。 */
export type SystemDecisionTaskBundle = Readonly<{
  task: DecisionTaskEntity
  candidates: ReadonlyArray<DecisionTaskCandidateEntity>
  exclusions: ReadonlyArray<SystemDecisionTaskExclusion>
}>
