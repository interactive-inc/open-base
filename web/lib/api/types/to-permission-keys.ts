import { permissionKeys } from "@/lib/api/types/permission-key"
import type { PermissionKey } from "@/lib/api/types/permission-key"

/**
 * api が返す権限キーの配列を、web の権限判定が使う PermissionKey へ絞る。
 * api 側にだけ存在する新しいキーは判定に使えないため落とす。
 * 落ちたキーは web の表示制御にだけ効き、最終的な認可は api が担う。
 */
export function toPermissionKeys(permissions: ReadonlyArray<string>): ReadonlyArray<PermissionKey> {
  const granted: ReadonlySet<string> = new Set(permissions)

  return permissionKeys.filter((permissionKey) => granted.has(permissionKey))
}
