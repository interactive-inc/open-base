import { isOrganizationalAuthorityStateEligible } from "@/contexts/company/domain/policies/is-organizational-authority-state-eligible.policy"
import type { OrganizationalAuthorityError } from "@/contexts/company/domain/errors"
import type {
  OrganizationalAuthorityCandidate,
  OrganizationalAuthorityProjection,
  OrganizationalAuthorityResolution,
} from "@/contexts/company/domain/definitions/organizational-authority.definition"
import { resolveOrganizationalAuthorityCriterion } from "@/contexts/company/domain/policies/resolve-organizational-authority-criterion.policy"
import { validateOrganizationalAuthorityProjection } from "@/contexts/company/domain/policies/validate-organizational-authority-projection.policy"
import type { AccountEmployeeLink } from "@/contexts/company/domain/definitions/workforce-schedule.definition"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"

/** Companyの固定済みWorkforce projectionだけから組織上の判断候補を解決する。 */
export function resolveOrganizationalAuthority(
  projection: OrganizationalAuthorityProjection,
): OrganizationalAuthorityResolution | OrganizationalAuthorityError {
  const projectionError = validateOrganizationalAuthorityProjection(projection)
  if (projectionError !== null) return projectionError

  const statesByEmployee = new Map(projection.states.map((state) => [state.employeeId, state]))
  const linksByEmployee = new Map<EmployeeId, AccountEmployeeLink>()
  for (const link of projection.accountLinks) linksByEmployee.set(link.employeeId, link)
  const candidates: OrganizationalAuthorityCandidate[] = []

  for (const [criterionIndex, criterion] of projection.criteria.entries()) {
    for (const candidate of resolveOrganizationalAuthorityCriterion({
      criterion,
      statesByEmployee,
      managementRelations: projection.managementRelations,
      subjectEmployeeId: projection.subjectEmployeeId,
      asOf: projection.snapshot.asOf,
    })) {
      if (candidate.employeeId === projection.subjectEmployeeId) continue
      const state = statesByEmployee.get(candidate.employeeId)
      const link = linksByEmployee.get(candidate.employeeId)
      if (
        state === undefined ||
        !isOrganizationalAuthorityStateEligible(state) ||
        link === undefined
      ) {
        continue
      }

      candidates.push({
        employeeId: candidate.employeeId,
        accountId: link.accountId,
        qualification: { criterionIndex, evidence: candidate.evidence },
      })
    }
  }

  return { snapshot: projection.snapshot, candidates }
}
