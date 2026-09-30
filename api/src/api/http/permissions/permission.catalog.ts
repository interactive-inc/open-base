import { API_COMPOSITION_PERMISSION_ENTRIES } from "@/api/http/permissions/api-composition-permission-entry.catalog"
import { SYSTEM_PERMISSION_ENTRIES } from "@/api/http/permissions/system-permission-entry.catalog"
import { SYSTEM_FEATURE_PERMISSION_ENTRIES } from "@system/domain/catalogs/iam/system-feature-permission-entry.catalog"
import type { PermissionKey } from "@/api/http/permissions/permission-key.catalog"

type PermissionEntry = {
  key: PermissionKey
  category: string
  featureKey: string | null
  description: string
}

/**
 * 全permissionのカタログ。keyとカテゴリ(UIグルーピング用)の対応を、所有contextから合成する。
 * permissionは "<domain>:<action>[:<scope>]" 形式の機械可読キー。
 * 語彙と表示メタデータの正本は所有するApp contextのentry catalogで、ここは束ねるだけにする。
 * PERMISSION_KEYSとのkey集合の一致、およびsystem_iam_role_permissionsの
 * seed行がこの集合に含まれることは api/tests/contracts/permission-catalog.contract.test.ts
 * が検査する。selfスコープ(本人==操作対象)はpermissionに載せず、
 * 所有者判定としてコードの不変条件に残す
 */
export const PERMISSION_CATALOG = [
  ...SYSTEM_PERMISSION_ENTRIES,
  ...SYSTEM_FEATURE_PERMISSION_ENTRIES,
  ...API_COMPOSITION_PERMISSION_ENTRIES,
] satisfies ReadonlyArray<PermissionEntry>
