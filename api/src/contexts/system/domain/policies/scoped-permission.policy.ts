import { SystemPermission } from "@system/domain/catalogs/iam/system-permission.catalog"
import type { PermissionValue } from "@system/domain/values/iam/permission.value"
import { evaluateSystemAccessPolicy } from "@system/domain/policies/evaluate-system-access.policy"

/**
 * API が解決した権限集合を、context が特定 scope で判定するための小さな読み取り専用 checker。
 * JWT・cookie・role・製品固有の request 型は受け取らない。
 */
export function createScopedPermissionChecker(
  globalPermissions: ReadonlySet<string>,
  scopedPermissions: ReadonlyMap<string, ReadonlySet<string>>,
) {
  const canGlobally = (permission: PermissionValue): boolean =>
    globalPermissions.has(SystemPermission.SYSTEM_ADMIN.key) ||
    globalPermissions.has(permission.key)

  const canAt = (permission: PermissionValue, scopeId: string | null): boolean => {
    if (scopeId === null && !canGlobally(permission)) {
      for (const permissions of scopedPermissions.values()) {
        if (permissions.has(permission.key)) return true
      }
    }
    return evaluateSystemAccessPolicy({
      permissionKeys: globalPermissions,
      scopedPermissionKeys: scopedPermissions,
      requiredPermission: permission.key,
      resourceScope: scopeId,
      field: null,
      allowedFields: null,
      purpose: null,
      allowedPurposes: null,
      validFrom: null,
      validUntil: null,
      evaluatedAt: new Date(0),
      authorityEvidence: null,
      authorityRequired: false,
      separationOfDutiesSatisfied: true,
    }).allowed
  }

  return Object.freeze({
    globalPermissions,
    scopedPermissions,
    can(...requestedPermissions: ReadonlyArray<PermissionValue>): boolean {
      return requestedPermissions.some((permission) => canAt(permission, null))
    },
    canAt,
    canAnyAt(permissions: ReadonlyArray<PermissionValue>, scopeId: string | null): boolean {
      return permissions.some((permission) => canAt(permission, scopeId))
    },
  })
}
