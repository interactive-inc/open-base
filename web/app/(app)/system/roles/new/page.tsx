import { RoleCreateForm } from "@/app/(app)/system/roles/_components/role-create-form"
import { FetchError } from "@/components/fetch-error"
import { PageHeader } from "@/components/page-header"
import { getMe } from "@/lib/api/get-me"
import { getPermissions } from "@/lib/api/get-permissions"
import { notFound } from "next/navigation"

export const metadata = { title: "ロール作成" }

/**
 * ロール作成画面。権限カタログを取得してチェックボックスフォームに渡す（iam:write が必要）。
 * 権限が無いユーザーには 404 を返す。
 */
export default async function AdminRoleNewPage() {
  const currentUser = await getMe()

  if (
    currentUser instanceof Error ||
    (currentUser.permissions.includes("system:admin") === false &&
      currentUser.permissions.includes("iam:write") === false)
  ) {
    notFound()
  }

  const permissions = await getPermissions()

  if (permissions instanceof Error) {
    return (
      <div className="flex flex-col gap-8">
        <PageHeader title="ロール作成" />

        <FetchError message="権限カタログの取得に失敗しました" />
      </div>
    )
  }

  // カタログのkeyはapi側の文字列なので、webが知らないkeyとも比較できるようstringで持つ。
  const actorPermissionKeys = new Set<string>(currentUser.permissions)

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="ロール作成" />

      <RoleCreateForm
        permissions={permissions.filter((permission) => actorPermissionKeys.has(permission.key))}
      />
    </div>
  )
}
