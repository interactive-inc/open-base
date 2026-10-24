import { SystemPermission } from "@system/domain/catalogs/iam/system-permission.catalog"

export type SystemAuthorityEvidence = Readonly<{
  context: string
  kind: string
  id: string
  version: string
}>

export type SystemAccessPolicyInput = Readonly<{
  permissionKeys: ReadonlySet<string>
  scopedPermissionKeys: ReadonlyMap<string, ReadonlySet<string>>
  requiredPermission: string
  resourceScope: string | null
  field: string | null
  allowedFields: ReadonlySet<string> | null
  purpose: string | null
  allowedPurposes: ReadonlySet<string> | null
  validFrom: Date | null
  validUntil: Date | null
  evaluatedAt: Date
  authorityEvidence: SystemAuthorityEvidence | null
  authorityRequired: boolean
  separationOfDutiesSatisfied: boolean
}>

export type SystemAccessPolicyReason =
  | "allowed"
  | "authority_required"
  | "field_denied"
  | "invalid_context"
  | "outside_validity"
  | "permission_denied"
  | "purpose_denied"
  | "scope_denied"
  | "separation_of_duties_denied"

export type SystemAccessPolicyDecision = Readonly<{
  allowed: boolean
  reason: SystemAccessPolicyReason
  authorityEvidence: SystemAuthorityEvidence | null
}>

function decision(
  allowed: boolean,
  reason: SystemAccessPolicyReason,
  authorityEvidence: SystemAuthorityEvidence | null,
): SystemAccessPolicyDecision {
  return Object.freeze({ allowed, reason, authorityEvidence })
}

function hasTechnicalPermission(input: SystemAccessPolicyInput): boolean {
  return (
    input.permissionKeys.has(SystemPermission.SYSTEM_ADMIN.key) ||
    input.permissionKeys.has(input.requiredPermission)
  )
}

function hasAnyPermission(input: SystemAccessPolicyInput): boolean {
  if (hasTechnicalPermission(input)) return true
  for (const permissions of input.scopedPermissionKeys.values()) {
    if (permissions.has(input.requiredPermission)) return true
  }
  return false
}

/** 技術権限・scope・条件・authority evidenceを一つのfail-closed判定へ統合する。 */
export function evaluateSystemAccessPolicy(
  input: SystemAccessPolicyInput,
): SystemAccessPolicyDecision {
  const evaluatedAt = input.evaluatedAt.getTime()
  const validFrom = input.validFrom?.getTime() ?? null
  const validUntil = input.validUntil?.getTime() ?? null
  if (!Number.isSafeInteger(evaluatedAt)) return decision(false, "invalid_context", null)
  if (!hasAnyPermission(input)) return decision(false, "permission_denied", null)
  if (
    !hasTechnicalPermission(input) &&
    input.resourceScope !== null &&
    !input.scopedPermissionKeys.get(input.resourceScope)?.has(input.requiredPermission)
  ) {
    return decision(false, "scope_denied", null)
  }
  if (
    input.field !== null &&
    input.allowedFields !== null &&
    !input.allowedFields.has(input.field)
  ) {
    return decision(false, "field_denied", null)
  }
  if (
    input.purpose !== null &&
    input.allowedPurposes !== null &&
    !input.allowedPurposes.has(input.purpose)
  ) {
    return decision(false, "purpose_denied", null)
  }
  if (
    (validFrom !== null && (!Number.isSafeInteger(validFrom) || evaluatedAt < validFrom)) ||
    (validUntil !== null && (!Number.isSafeInteger(validUntil) || evaluatedAt >= validUntil))
  ) {
    return decision(false, "outside_validity", null)
  }
  if (!input.separationOfDutiesSatisfied) {
    return decision(false, "separation_of_duties_denied", null)
  }
  if (input.authorityRequired && input.authorityEvidence === null) {
    return decision(false, "authority_required", null)
  }
  return decision(true, "allowed", input.authorityEvidence)
}
