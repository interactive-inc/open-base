import { SystemPermission } from "@system/domain/catalogs/iam/system-permission.catalog"

/** System機能の認可とRole作成に使う権限語彙を読む。 */
export function readSystemPermissionCatalog() {
  return SystemPermission
}
