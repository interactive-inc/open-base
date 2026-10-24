import { evaluateSystemAccessPolicy } from "@system/domain/policies/evaluate-system-access.policy"
import { systemResourceScopeKey } from "@system/domain/definitions/system-resource-scope-key.definition"
import type { RoleBindingResource } from "@system/domain/schemas/iam/role-binding.schema"

export type SystemOperationAuthorizationContext = Readonly<{
  scopedPermissionKeys?: ReadonlyMap<string, ReadonlySet<string>>
  resource?: RoleBindingResource | null
  field?: string | null
  allowedFields?: ReadonlySet<string> | null
  purpose?: string | null
  allowedPurposes?: ReadonlySet<string> | null
  validFrom?: Date | null
  validUntil?: Date | null
  authorityEvidence?: Readonly<{
    context: string
    kind: string
    id: string
    version: string
  }> | null
  authorityRequired?: boolean
  separationOfDutiesSatisfied?: boolean
}>

/** HTTP操作をcanonical System policyのfail-closed既定値で評価する。 */
export function authorizeSystemOperation(
  permissionKeys: ReadonlySet<string>,
  requiredPermission: string,
  evaluatedAt: Date,
  authorization: SystemOperationAuthorizationContext = {},
): boolean {
  const resource = authorization.resource ?? null
  return evaluateSystemAccessPolicy({
    permissionKeys,
    scopedPermissionKeys: authorization.scopedPermissionKeys ?? new Map(),
    requiredPermission,
    resourceScope: resource === null ? null : systemResourceScopeKey(resource),
    field: authorization.field ?? null,
    allowedFields: authorization.allowedFields ?? null,
    purpose: authorization.purpose ?? null,
    allowedPurposes: authorization.allowedPurposes ?? null,
    validFrom: authorization.validFrom ?? null,
    validUntil: authorization.validUntil ?? null,
    evaluatedAt,
    authorityEvidence: authorization.authorityEvidence ?? null,
    authorityRequired: authorization.authorityRequired ?? false,
    separationOfDutiesSatisfied: authorization.separationOfDutiesSatisfied ?? true,
  }).allowed
}
