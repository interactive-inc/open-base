import { DeleteRoleButton } from "@/app/(app)/system/roles/_components/delete-role-button"
import { FetchError } from "@/components/fetch-error"
import { TableRowActions } from "@/components/table-row-actions"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { StatusLabel } from "@/components/status-label"
import { buttonVariants } from "@/components/ui/button"
import { getRoles } from "@/lib/api/get-roles"
import Link from "next/link"

/** GET /roles を実行しロール一覧テーブルを描画する非同期 RSC。 */
export async function RoleListSection(props: { actorPermissionKeys: ReadonlyArray<string> }) {
  const actorPermissionKeys = new Set(props.actorPermissionKeys)

  const roles = await getRoles()

  if (roles instanceof Error) {
    return <FetchError message="ロール一覧の取得に失敗しました" />
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">{roles.length} 件</p>

      <Table aria-label="一覧">
        <TableHeader>
          <TableRow>
            <TableHead>キー</TableHead>
            <TableHead>名前</TableHead>
            <TableHead>説明</TableHead>
            <TableHead>種別</TableHead>
            <TableHead>操作</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {roles.map((role) => {
            const canManage = role.permission_keys.every((permissionKey) =>
              actorPermissionKeys.has(permissionKey),
            )

            return (
              <TableRow key={role.id}>
                <TableCell>{role.key}</TableCell>
                <TableCell>{role.name}</TableCell>
                <TableCell>{role.description ?? "—"}</TableCell>
                <TableCell>
                  {role.is_system ? (
                    <StatusLabel>システム</StatusLabel>
                  ) : (
                    <StatusLabel>動的</StatusLabel>
                  )}
                </TableCell>
                <TableCell>
                  {canManage ? (
                    <TableRowActions>
                      <Link
                        href={`/system/roles/${role.id}/edit`}
                        className={buttonVariants({ variant: "secondary", size: "sm" })}
                      >
                        編集
                      </Link>

                      {role.is_system ? null : (
                        <DeleteRoleButton roleId={role.id} roleName={role.name} />
                      )}
                    </TableRowActions>
                  ) : (
                    <span className="text-sm text-muted-foreground">上位ロール</span>
                  )}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
