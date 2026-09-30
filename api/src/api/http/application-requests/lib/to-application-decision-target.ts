import type { SystemProposalView } from "@system/domain/definitions/workflow/system-proposal-view.definition"

/** 本文と同じProposal snapshotから、判断時に送り返す参照を作る。 */
export function toApplicationDecisionTarget(proposal: SystemProposalView) {
  return {
    proposal_version: proposal.version,
    proposal_digest: proposal.digest,
    task_key: proposal.currentTaskKey ?? proposal.lastTaskKey,
    task_round: proposal.currentTaskRound ?? proposal.lastTaskRound,
  }
}
