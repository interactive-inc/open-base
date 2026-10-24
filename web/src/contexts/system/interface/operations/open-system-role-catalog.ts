import { SystemRoleCatalogRepository } from "@system/infrastructure/repositories/iam/system-role-catalog.repository"

/** namespaced permissionを束ねるSystem Roleの保存口を開く。 */
export function openSystemRoleCatalog(
  context: ConstructorParameters<typeof SystemRoleCatalogRepository>[0],
): SystemRoleCatalogRepository {
  return new SystemRoleCatalogRepository(context)
}
