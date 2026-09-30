import { SystemIdentityCatalogRepository } from "@system/infrastructure/repositories/identity/system-identity-catalog.repository"

/** Accountのlogin Identityとcredential projectionをCompanyなしで扱う保存口を開く。 */
export function openSystemIdentityCatalog(
  context: ConstructorParameters<typeof SystemIdentityCatalogRepository>[0],
): SystemIdentityCatalogRepository {
  return new SystemIdentityCatalogRepository(context)
}
