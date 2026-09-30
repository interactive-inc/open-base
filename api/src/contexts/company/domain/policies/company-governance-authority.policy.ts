import type { CompanyResourceEntity } from "@/contexts/company/domain/entities/company-resource.entity"
import { CompanyGovernanceAuthorityError } from "@/contexts/company/domain/errors"
import type { CalendarDate } from "@/contexts/company/domain/definitions/calendar-date.definition"

export type CompanyGovernanceScope =
  | Readonly<{
      scopeType: "organization-unit" | "legal-entity" | "site" | "workplace"
      scopeId: string
    }>
  | Readonly<{ scopeType: "region"; regionCode: string }>
  | Readonly<{ scopeType: "amount"; currencyCode: string; amount: number }>

export type CompanyGovernanceAuthorityCriterion = Readonly<{
  responsibilityCode: string
  scope: CompanyGovernanceScope | null
}>

export type CompanyCollectiveDecisionSnapshot = Readonly<{
  collectiveBodyId: string
  votingMemberCount: number
  quorumRequired: number
  approvalRequired: number
  decisionRule: "unanimity" | "majority" | "qualified-majority"
}>

export type CompanyGovernanceAuthorityQualification = Readonly<{
  criterionIndex: number
  responsibilityId: string
  responsibilityRevision: number
  assignmentId: string
  assignmentRevision: number
  holderType: "employee" | "organizational-office" | "collective-body"
  holderId: string
  authorityScopeId: string | null
  authorityScopeRevision: number | null
  delegationAllowed: boolean
  employmentId: string
  employmentRevision: number
  accountEmployeeLinkId: string
  accountEmployeeLinkRevision: number
  collectiveDecision: CompanyCollectiveDecisionSnapshot | null
}>

export type CompanyGovernanceAuthorityCandidate = Readonly<{
  employeeId: string
  accountId: string
  qualifications: ReadonlyArray<CompanyGovernanceAuthorityQualification>
}>

export type CompanyGovernanceAuthorityExclusion = Readonly<{
  employeeId: string
  accountId: string
  reason: "subject"
}>

export type CompanyGovernanceAuthorityResolution = Readonly<{
  snapshot: Readonly<{
    schemaVersion: 1
    source: "company-resource"
    asOf: CalendarDate
    organizationRevision: number
  }>
  candidates: ReadonlyArray<CompanyGovernanceAuthorityCandidate>
  exclusions: ReadonlyArray<CompanyGovernanceAuthorityExclusion>
}>

export type CompanyGovernanceAuthorityProjection = Readonly<{
  asOf: CalendarDate
  organizationRevision: number
  subjectEmployeeId: string | null
  criteria: ReadonlyArray<CompanyGovernanceAuthorityCriterion>
  resources: ReadonlyArray<CompanyResourceEntity>
  activeAccountIds: ReadonlySet<string>
}>

type CandidateAccumulator = {
  employeeId: string
  accountId: string
  qualifications: CompanyGovernanceAuthorityQualification[]
}

/** Company v1の責務・scope・Office・合議体を同一時点で解決し、Account候補を返す。 */
export function resolveCompanyGovernanceAuthority(
  projection: CompanyGovernanceAuthorityProjection,
): CompanyGovernanceAuthorityResolution | CompanyGovernanceAuthorityError {
  if (
    !Number.isSafeInteger(projection.organizationRevision) ||
    projection.organizationRevision < 0 ||
    projection.criteria.length < 1
  ) {
    return error("governance_authority_snapshot_invalid")
  }
  const resources = new Map<string, CompanyResourceEntity>()
  for (const resource of projection.resources) {
    const key = resourceKey(resource.type, resource.id)
    if (resources.has(key) || !resource.contains(projection.asOf) || resource.state !== "active") {
      return error("governance_authority_resource_ambiguous")
    }
    resources.set(key, resource)
  }

  const accountLinks = projection.resources.filter(
    (resource) => resource.type === "account-employee-link",
  )
  const linksByEmployee = new Map<string, CompanyResourceEntity>()
  const linkedAccountIds = new Set<string>()
  for (const link of accountLinks) {
    const employeeId = text(link, "employeeId")
    const accountId = text(link, "accountId")
    if (
      employeeId === null ||
      accountId === null ||
      linksByEmployee.has(employeeId) ||
      linkedAccountIds.has(accountId)
    ) {
      return error("governance_authority_account_link_ambiguous")
    }
    linksByEmployee.set(employeeId, link)
    linkedAccountIds.add(accountId)
  }

  const responsibilitiesByCode = new Map<string, CompanyResourceEntity>()
  for (const responsibility of projection.resources.filter(
    (resource) => resource.type === "responsibility",
  )) {
    const code = text(responsibility, "code")
    if (code === null || responsibilitiesByCode.has(code)) {
      return error("governance_authority_resource_ambiguous")
    }
    responsibilitiesByCode.set(code, responsibility)
  }

  const candidates = new Map<string, CandidateAccumulator>()
  for (const [criterionIndex, criterion] of projection.criteria.entries()) {
    const responsibility = responsibilitiesByCode.get(criterion.responsibilityCode)
    if (responsibility === undefined) {
      return error("governance_authority_reference_missing")
    }
    const assignments = projection.resources.filter(
      (resource) =>
        resource.type === "responsibility-assignment" &&
        text(resource, "responsibilityId") === responsibility.id,
    )
    for (const assignment of assignments) {
      const resolvedScope = resolveScope(assignment, criterion.scope, resources)
      if (resolvedScope instanceof CompanyGovernanceAuthorityError) return resolvedScope
      if (!resolvedScope.matched) continue
      const holders = expandHolders(assignment, projection.resources, resources)
      if (holders instanceof CompanyGovernanceAuthorityError) return holders
      for (const holder of holders) {
        if (holder.employeeId === projection.subjectEmployeeId) continue
        const employment = findEligibleEmployment(
          holder.employeeId,
          projection.resources,
          resources,
        )
        if (employment instanceof CompanyGovernanceAuthorityError) return employment
        if (employment === null) continue
        const link = linksByEmployee.get(holder.employeeId)
        const accountId = link === undefined ? null : text(link, "accountId")
        if (
          link === undefined ||
          accountId === null ||
          !projection.activeAccountIds.has(accountId)
        ) {
          continue
        }
        const current = candidates.get(accountId) ?? {
          employeeId: holder.employeeId,
          accountId,
          qualifications: [],
        }
        if (current.employeeId !== holder.employeeId) {
          return error("governance_authority_account_link_ambiguous")
        }
        current.qualifications.push({
          criterionIndex,
          responsibilityId: responsibility.id,
          responsibilityRevision: responsibility.revision,
          assignmentId: assignment.id,
          assignmentRevision: assignment.revision,
          holderType: holder.holderType,
          holderId: holder.holderId,
          authorityScopeId: resolvedScope.resource?.id ?? null,
          authorityScopeRevision: resolvedScope.resource?.revision ?? null,
          delegationAllowed: boolean(assignment, "delegationAllowed") ?? false,
          employmentId: employment.id,
          employmentRevision: employment.revision,
          accountEmployeeLinkId: link.id,
          accountEmployeeLinkRevision: link.revision,
          collectiveDecision: holder.collectiveDecision,
        })
        candidates.set(accountId, current)
      }
    }
  }

  const exclusions: CompanyGovernanceAuthorityExclusion[] = []
  if (projection.subjectEmployeeId !== null) {
    const link = linksByEmployee.get(projection.subjectEmployeeId)
    const accountId = link === undefined ? null : text(link, "accountId")
    if (accountId !== null && projection.activeAccountIds.has(accountId)) {
      exclusions.push({ employeeId: projection.subjectEmployeeId, accountId, reason: "subject" })
    }
  }

  return {
    snapshot: {
      schemaVersion: 1,
      source: "company-resource",
      asOf: projection.asOf,
      organizationRevision: projection.organizationRevision,
    },
    candidates: [...candidates.values()]
      .toSorted((left, right) => compare(left.accountId, right.accountId))
      .map((candidate) => ({
        employeeId: candidate.employeeId,
        accountId: candidate.accountId,
        qualifications: candidate.qualifications.toSorted(
          (left, right) =>
            left.criterionIndex - right.criterionIndex ||
            compare(left.assignmentId, right.assignmentId),
        ),
      })),
    exclusions,
  }
}

function resolveScope(
  assignment: CompanyResourceEntity,
  criterion: CompanyGovernanceScope | null,
  resources: ReadonlyMap<string, CompanyResourceEntity>,
):
  | Readonly<{ matched: boolean; resource: CompanyResourceEntity | null }>
  | CompanyGovernanceAuthorityError {
  const scopeId = nullableText(assignment, "authorityScopeId")
  if (scopeId === undefined) return error("governance_authority_reference_missing")
  if (scopeId === null) return { matched: true, resource: null }
  const scope = resources.get(resourceKey("authority-scope", scopeId))
  if (scope === undefined) return error("governance_authority_reference_missing")
  if (criterion === null) return { matched: false, resource: scope }
  const scopeType = text(scope, "scopeType")
  if (scopeType !== criterion.scopeType) return { matched: false, resource: scope }
  if (
    scopeType === "organization-unit" ||
    scopeType === "legal-entity" ||
    scopeType === "site" ||
    scopeType === "workplace"
  ) {
    const targetId = text(scope, "scopeId")
    if (targetId === null) return error("governance_authority_reference_missing")
    if (scopeType === "organization-unit") {
      const units = [...resources.values()].filter(
        (resource) =>
          resource.type === "organization-unit" &&
          text(resource, "organizationUnitId") === targetId,
      )
      if (units.length === 0) return error("governance_authority_reference_missing")
      if (units.length !== 1) return error("governance_authority_resource_ambiguous")
    } else if (!resources.has(resourceKey(scopeType, targetId))) {
      return error("governance_authority_reference_missing")
    }
    return {
      matched: "scopeId" in criterion && targetId === criterion.scopeId,
      resource: scope,
    }
  }
  if (scopeType === "region") {
    return {
      matched: "regionCode" in criterion && text(scope, "regionCode") === criterion.regionCode,
      resource: scope,
    }
  }
  if (scopeType !== "amount" || !("amount" in criterion)) {
    return { matched: false, resource: scope }
  }
  const minimum = nullableNumber(scope, "minimumAmount")
  const maximum = nullableNumber(scope, "maximumAmount")
  const currency = text(scope, "currencyCode")
  if (minimum === undefined || maximum === undefined || currency === null) {
    return error("governance_authority_reference_missing")
  }
  return {
    matched:
      currency === criterion.currencyCode &&
      (minimum === null || criterion.amount >= minimum) &&
      (maximum === null || criterion.amount <= maximum),
    resource: scope,
  }
}

function expandHolders(
  assignment: CompanyResourceEntity,
  allResources: ReadonlyArray<CompanyResourceEntity>,
  resources: ReadonlyMap<string, CompanyResourceEntity>,
):
  | ReadonlyArray<{
      employeeId: string
      holderType: "employee" | "organizational-office" | "collective-body"
      holderId: string
      collectiveDecision: CompanyCollectiveDecisionSnapshot | null
    }>
  | CompanyGovernanceAuthorityError {
  const holderType = text(assignment, "holderType")
  const holderId = text(assignment, "holderId")
  if (
    holderId === null ||
    (holderType !== "employee" &&
      holderType !== "organizational-office" &&
      holderType !== "collective-body")
  ) {
    return error("governance_authority_reference_missing")
  }
  if (holderType === "employee") {
    if (!resources.has(resourceKey("employee", holderId))) {
      return error("governance_authority_reference_missing")
    }
    return [{ employeeId: holderId, holderType, holderId, collectiveDecision: null }]
  }
  if (holderType === "organizational-office") {
    if (!resources.has(resourceKey("organizational-office", holderId))) {
      return error("governance_authority_reference_missing")
    }
    return allResources
      .filter(
        (resource) =>
          resource.type === "office-assignment" &&
          text(resource, "organizationalOfficeId") === holderId,
      )
      .map((resource) => text(resource, "employeeId"))
      .flatMap((employeeId) =>
        employeeId === null ? [] : [{ employeeId, holderType, holderId, collectiveDecision: null }],
      )
  }

  const body = resources.get(resourceKey("collective-body", holderId))
  if (body === undefined) return error("governance_authority_reference_missing")
  const votingMembers = allResources
    .filter(
      (resource) =>
        resource.type === "collective-body-membership" &&
        text(resource, "collectiveBodyId") === holderId &&
        boolean(resource, "voting") === true,
    )
    .map((resource) => text(resource, "employeeId"))
  if (votingMembers.some((employeeId) => employeeId === null)) {
    return error("governance_authority_collective_body_invalid")
  }
  const memberIds = votingMembers.flatMap((employeeId) => (employeeId === null ? [] : [employeeId]))
  const quorumType = text(body, "quorumType")
  const quorumValue = number(body, "quorumValue")
  const decisionRule = text(body, "decisionRule")
  if (
    memberIds.length < 1 ||
    quorumValue === null ||
    (quorumType !== "count" && quorumType !== "percentage") ||
    (decisionRule !== "unanimity" &&
      decisionRule !== "majority" &&
      decisionRule !== "qualified-majority")
  ) {
    return error("governance_authority_collective_body_invalid")
  }
  const quorumRequired =
    quorumType === "count" ? quorumValue : Math.ceil((memberIds.length * quorumValue) / 100)
  const approvalRequired =
    decisionRule === "unanimity"
      ? memberIds.length
      : decisionRule === "majority"
        ? Math.floor(memberIds.length / 2) + 1
        : Math.ceil((memberIds.length * 2) / 3)
  if (quorumRequired > memberIds.length) {
    return error("governance_authority_collective_body_invalid")
  }
  const collectiveDecision: CompanyCollectiveDecisionSnapshot = {
    collectiveBodyId: body.id,
    votingMemberCount: memberIds.length,
    quorumRequired,
    approvalRequired,
    decisionRule,
  }
  return memberIds.map((employeeId) => ({
    employeeId,
    holderType,
    holderId,
    collectiveDecision,
  }))
}

function findEligibleEmployment(
  employeeId: string,
  allResources: ReadonlyArray<CompanyResourceEntity>,
  resources: ReadonlyMap<string, CompanyResourceEntity>,
): CompanyResourceEntity | null | CompanyGovernanceAuthorityError {
  if (!resources.has(resourceKey("employee", employeeId))) {
    return error("governance_authority_reference_missing")
  }
  const employments = allResources.filter(
    (resource) =>
      resource.type === "employment" &&
      text(resource, "employeeId") === employeeId &&
      (text(resource, "status") === "ACTIVE" || text(resource, "status") === "ON_LEAVE"),
  )
  if (employments.length > 1) return error("governance_authority_resource_ambiguous")
  const employment = employments[0]
  return employment !== undefined && text(employment, "status") === "ACTIVE" ? employment : null
}

function resourceKey(type: string, id: string): string {
  return `${type}\u0000${id}`
}

function text(resource: CompanyResourceEntity, key: string): string | null {
  const value = resource.attributes[key]
  return typeof value === "string" && value.length > 0 ? value : null
}

function nullableText(resource: CompanyResourceEntity, key: string): string | null | undefined {
  const value = resource.attributes[key]
  return value === null || value === undefined
    ? value
    : typeof value === "string" && value.length > 0
      ? value
      : undefined
}

function boolean(resource: CompanyResourceEntity, key: string): boolean | null {
  const value = resource.attributes[key]
  return typeof value === "boolean" ? value : null
}

function number(resource: CompanyResourceEntity, key: string): number | null {
  const value = resource.attributes[key]
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function nullableNumber(resource: CompanyResourceEntity, key: string): number | null | undefined {
  const value = resource.attributes[key]
  return value === null || value === undefined
    ? value
    : typeof value === "number" && Number.isFinite(value)
      ? value
      : undefined
}

function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function error(
  code: ConstructorParameters<typeof CompanyGovernanceAuthorityError>[0],
): CompanyGovernanceAuthorityError {
  return new CompanyGovernanceAuthorityError(code)
}
