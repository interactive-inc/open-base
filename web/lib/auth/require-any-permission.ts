import { notFound } from "next/navigation"
import { getMe } from "@/lib/api/get-me"
import type { MeResponse } from "@/lib/api/types/auth-types"
import type { PermissionKey } from "@/lib/api/types/permission-key"

/**
 * いずれか 1 つの permission を持つ利用者だけに画面を通す。
 * api 側が複数キーの OR で認可する機能（Company の読み取りは
 * employee:read / org:manage / system:admin の OR）で、単一キー判定にすると
 * web だけが 404 を返して api と食い違うため用意する。
 */
export async function requireAnyPermission(
  permissions: ReadonlyArray<PermissionKey>,
): Promise<MeResponse> {
  const currentUser = await getMe()

  if (currentUser instanceof Error) {
    notFound()
  }

  const isPermitted = permissions.some((permission) => currentUser.permissions.includes(permission))

  if (isPermitted === false) {
    notFound()
  }

  return currentUser
}
