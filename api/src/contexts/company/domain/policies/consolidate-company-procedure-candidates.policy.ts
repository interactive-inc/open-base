import type { WorkflowStepCandidateSnapshot } from "@/contexts/company/domain/definitions/company-procedure-step-snapshot.definition"

/** Accountごとに通常候補を優先し、双方の資格根拠を保持する。 */
export function consolidateCompanyProcedureCandidates(
  candidates: ReadonlyArray<WorkflowStepCandidateSnapshot>,
): ReadonlyArray<WorkflowStepCandidateSnapshot> {
  const byAccount = new Map<
    WorkflowStepCandidateSnapshot["accountId"],
    WorkflowStepCandidateSnapshot
  >()
  for (const candidate of candidates) {
    const previous = byAccount.get(candidate.accountId)
    if (previous === undefined) {
      byAccount.set(candidate.accountId, candidate)
      continue
    }
    const preferred = previous.source === "primary" ? previous : candidate
    byAccount.set(candidate.accountId, {
      ...preferred,
      selectorsJson: JSON.stringify([
        ...JSON.parse(previous.selectorsJson),
        ...JSON.parse(candidate.selectorsJson),
      ]),
    })
  }
  return [...byAccount.values()]
}
