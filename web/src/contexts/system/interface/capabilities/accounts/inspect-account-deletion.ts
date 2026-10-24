import type { SystemDatabase } from "@system/configuration/system-context"
import { SystemPermission } from "@system/domain/catalogs/iam/system-permission.catalog"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import {
  systemAccounts,
  systemAccountInvitations,
  systemIamRolePermissions,
  systemRoleBindings,
} from "@system/infrastructure/schema/system-core"
import { and, eq, inArray, isNull, ne } from "drizzle-orm"

/** System Accountを閉鎖する前に、root不変条件とSystem所有証跡を収集する。 */
export async function inspectSystemAccountDeletion(
  database: SystemDatabase,
  targetAccountId: string,
) {
  const accountId = zAccountId.parse(targetAccountId)
  const [targetRows, targetRoleBindings, rootRoleRows, acceptedInvitations] = await Promise.all([
    database
      .select({ status: systemAccounts.status })
      .from(systemAccounts)
      .where(eq(systemAccounts.id, accountId))
      .limit(1),
    database
      .select()
      .from(systemRoleBindings)
      .where(
        and(eq(systemRoleBindings.accountId, accountId), isNull(systemRoleBindings.revokedAt)),
      ),
    database
      .select({ roleId: systemIamRolePermissions.roleId })
      .from(systemIamRolePermissions)
      .where(eq(systemIamRolePermissions.permissionKey, SystemPermission.SYSTEM_ADMIN.key)),
    database
      .select()
      .from(systemAccountInvitations)
      .where(eq(systemAccountInvitations.usedBy, accountId)),
  ])
  const rootRoleIds = [...new Set(rootRoleRows.map((row) => row.roleId))]
  const targetHasRootGrant = targetRoleBindings.some(
    (binding) =>
      binding.resourceType === null &&
      binding.resourceId === null &&
      rootRoleIds.includes(binding.roleId),
  )
  const targetIsActiveRoot = targetHasRootGrant && targetRows[0]?.status === "active"
  const otherActiveRootRows =
    targetIsActiveRoot && rootRoleIds.length > 0
      ? await database
          .select({ accountId: systemRoleBindings.accountId })
          .from(systemRoleBindings)
          .innerJoin(systemAccounts, eq(systemAccounts.id, systemRoleBindings.accountId))
          .where(
            and(
              inArray(systemRoleBindings.roleId, rootRoleIds),
              ne(systemRoleBindings.accountId, accountId),
              isNull(systemRoleBindings.resourceType),
              isNull(systemRoleBindings.resourceId),
              isNull(systemRoleBindings.revokedAt),
              eq(systemAccounts.status, "active"),
            ),
          )
      : []

  return {
    rootPolicy: {
      targetHasRootGrant,
      targetIsActiveRoot,
      otherActiveRootCount: new Set(otherActiveRootRows.map((row) => row.accountId)).size,
    },
    blockers: [],
    snapshot: { roleBindings: targetRoleBindings, acceptedInvitations },
  }
}
