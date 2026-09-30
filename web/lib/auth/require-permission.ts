import { notFound } from "next/navigation"
import { getMe } from "@/lib/api/get-me"
import type { MeResponse } from "@/lib/api/types/auth-types"
import type { PermissionKey } from "@/lib/api/types/permission-key"

/**
 * 管理画面の直接 URL アクセスを実効 permission で拒否する。
 * API が最終認可を担うが、Web でも権限のない機能や存在を露出しない。
 */
export async function requirePermission(permission: PermissionKey): Promise<MeResponse> {
  const currentUser = await getMe()

  if (currentUser instanceof Error || currentUser.permissions.includes(permission) === false) {
    notFound()
  }

  return currentUser
}
