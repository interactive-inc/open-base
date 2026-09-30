import type { WorkforceStateAt } from "@/contexts/company/domain/policies/resolve-workforce-state.policy"

export function isOrganizationalAuthorityStateEligible(state: WorkforceStateAt): boolean {
  return state.employmentId !== null && (state.status === "ACTIVE" || state.status === "ON_LEAVE")
}
