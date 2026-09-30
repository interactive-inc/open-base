import { AccountStatusButton } from "@/app/(app)/system/accounts/_components/account-status-button"
import { ResetPasswordButton } from "@/app/(app)/system/accounts/_components/reset-password-button"
import { RevokeRoleButton } from "@/app/(app)/system/accounts/_components/revoke-role-button"
import { GrantRoleForm } from "@/app/(app)/system/accounts/_components/grant-role-form"
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
import { getAccounts } from "@/lib/api/get-accounts"
import { getRoles } from "@/lib/api/get-roles"

/**
 * 正規 System API から Account・Role・Role Binding を読み、管理表を描画する。
 */
export async function AccountListSection(props: {
  canWrite: boolean
  actorPermissionKeys: ReadonlyArray<string>
}) {
  const actorPermissionKeys = new Set(props.actorPermissionKeys)

  const [accounts, roles] = await Promise.all([getAccounts(), props.canWrite ? getRoles() : []])

  if (accounts instanceof Error) {
    return <FetchError message="アカウント一覧の取得に失敗しました" />
  }

  const assignableRoles =
    roles instanceof Error
      ? []
      : roles.filter((role) =>
          role.permission_keys.every((permissionKey) => actorPermissionKeys.has(permissionKey)),
        )

  const roleById = new Map(
    (roles instanceof Error ? [] : roles).map((role) => [role.id, role] as const),
  )

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">{accounts.length} 件</p>

      <Table aria-label="一覧">
        <TableHeader>
          <TableRow>
            <TableHead>Account ID</TableHead>
            <TableHead>状態</TableHead>
            <TableHead>ロール</TableHead>
            <TableHead>ロール付与</TableHead>
            <TableHead>操作</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {accounts.map((account) => (
            <TableRow key={account.id}>
              <TableCell>{account.id}</TableCell>
              <TableCell>
                <StatusLabel>{account.status}</StatusLabel>
              </TableCell>
              <TableCell className="flex flex-wrap gap-2">
                {account.role_bindings.length === 0 ? (
                  <span className="text-muted-foreground">—</span>
                ) : (
                  account.role_bindings.map((binding) => {
                    const role = roleById.get(binding.role_id)
                    const roleLabel = role?.key ?? binding.role_id
                    const canRevoke =
                      props.canWrite &&
                      role?.permission_keys.every((permissionKey) =>
                        actorPermissionKeys.has(permissionKey),
                      )

                    if (canRevoke) {
                      return (
                        <RevokeRoleButton
                          key={binding.id}
                          accountId={account.id}
                          bindingId={binding.id}
                          roleLabel={roleLabel}
                        />
                      )
                    }

                    return <StatusLabel key={binding.id}>{roleLabel}</StatusLabel>
                  })
                )}
              </TableCell>
              <TableCell>
                {props.canWrite ? (
                  <GrantRoleForm
                    accountId={account.id}
                    roles={assignableRoles.filter(
                      (role) =>
                        account.role_bindings.some((binding) => binding.role_id === role.id) ===
                        false,
                    )}
                  />
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>
                {props.canWrite ? (
                  <TableRowActions>
                    <AccountStatusButton accountId={account.id} status={account.status} />

                    <ResetPasswordButton accountId={account.id} />
                  </TableRowActions>
                ) : (
                  <span className="text-sm text-muted-foreground">閲覧のみ</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
