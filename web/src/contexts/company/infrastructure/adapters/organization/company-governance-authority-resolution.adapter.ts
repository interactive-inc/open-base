import type { CompanyResourceEntity } from "@/contexts/company/domain/entities/company-resource.entity"
import type { CalendarDate } from "@/contexts/company/domain/definitions/calendar-date.definition"
import type {
  CompanyGovernanceAuthorityCriterion,
  CompanyGovernanceAuthorityResolution,
} from "@/contexts/company/domain/policies/company-governance-authority.policy"
import { resolveCompanyGovernanceAuthority } from "@/contexts/company/domain/policies/company-governance-authority.policy"
import { CompanyGovernanceAuthorityError } from "@/contexts/company/domain/errors"
import type { CompanyResourceRepository } from "@/contexts/company/infrastructure/repositories/core/d1-company-resource.repository"

type Result =
  | Readonly<{ kind: "resolved"; resolution: CompanyGovernanceAuthorityResolution }>
  | Readonly<{ kind: "invalid"; error: CompanyGovernanceAuthorityError }>
  | Readonly<{ kind: "unavailable"; cause: unknown }>

type Context = Readonly<{
  repository: Pick<CompanyResourceRepository, "findMany">
  readActiveAccountIds: (accountIds: ReadonlyArray<string>) => Promise<ReadonlySet<string> | Error>
}>

/** Company resource snapshotとliveなSystem Accountを合成し、会社上の判断資格を固定する。 */
export class CompanyGovernanceAuthorityResolutionAdapter {
  private static readonly authorityResourceTypes: ReadonlyArray<CompanyResourceEntity["type"]> = [
    "legal-entity",
    "site",
    "workplace",
    "employee",
    "employment",
    "organization-unit",
    "organizational-office",
    "office-assignment",
    "responsibility",
    "authority-scope",
    "responsibility-assignment",
    "collective-body",
    "collective-body-membership",
    "account-employee-link",
  ]

  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async resolve(
    input: Readonly<{
      organizationId: string
      asOf: CalendarDate
      subjectEmployeeId: string | null
      criteria: ReadonlyArray<CompanyGovernanceAuthorityCriterion>
    }>,
  ): Promise<Result> {
    const read = await this.c.repository.findMany({
      organizationId: input.organizationId,
      types: CompanyGovernanceAuthorityResolutionAdapter.authorityResourceTypes,
      effectiveOn: input.asOf,
    })
    if (!read.ok) return { kind: "unavailable", cause: read.cause }

    const accountIds = new Set<string>()
    for (const resource of read.resources) {
      if (resource.type !== "account-employee-link") continue
      const accountId = resource.readText("accountId")
      if (accountId === null) {
        return {
          kind: "invalid",
          error: new CompanyGovernanceAuthorityError("governance_authority_account_link_ambiguous"),
        }
      }
      accountIds.add(accountId)
    }
    const activeAccountIds = await this.c.readActiveAccountIds([...accountIds].toSorted())
    if (activeAccountIds instanceof Error) return { kind: "unavailable", cause: activeAccountIds }
    if ([...activeAccountIds].some((accountId) => !accountIds.has(accountId)))
      return {
        kind: "unavailable",
        cause: new Error("active Account response contains an unexpected identity"),
      }
    const resolution = resolveCompanyGovernanceAuthority({
      asOf: input.asOf,
      organizationRevision: read.organizationRevision,
      subjectEmployeeId: input.subjectEmployeeId,
      criteria: input.criteria,
      resources: read.resources,
      activeAccountIds,
    })
    return resolution instanceof CompanyGovernanceAuthorityError
      ? { kind: "invalid", error: resolution }
      : { kind: "resolved", resolution }
  }
}
