import { SystemAccountCatalogRepository } from "@system/infrastructure/repositories/iam/system-account-catalog.repository"

/** Account一覧と、失効を伴うstatus変更をCompanyなしで扱う保存口を開く。 */
export function openSystemAccountCatalog(
  context: ConstructorParameters<typeof SystemAccountCatalogRepository>[0],
): SystemAccountCatalogRepository {
  return new SystemAccountCatalogRepository(context)
}
