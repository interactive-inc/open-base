import { zAccountId, type AccountId } from "@system/domain/schemas/iam/account-id.schema"

type Context = D1Database

type Row = Readonly<{ account_id: unknown }>

/** 有効なrole割当でpermissionを保持するactive Accountを、global割当と指定resource割当から読む。 */
export class ListSystemPermissionHolderAccountsAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async list(
    input: Readonly<{
      permissionKey: string
      resource: Readonly<{ type: string; id: string }> | null
    }>,
  ): Promise<ReadonlyArray<AccountId> | Error> {
    try {
      const result = await this.c
        .prepare(
          `SELECT DISTINCT binding.account_id
           FROM system_role_bindings binding
           INNER JOIN system_iam_role_permissions permission
             ON permission.role_id = binding.role_id AND permission.permission_key = ?1
           INNER JOIN system_accounts account ON account.id = binding.account_id
           WHERE binding.revoked_at IS NULL
             AND account.status = 'active'
             AND (
               (binding.resource_type IS NULL AND binding.resource_id IS NULL)
               OR (binding.resource_type = ?2 AND binding.resource_id = ?3)
             )
           ORDER BY binding.account_id`,
        )
        .bind(input.permissionKey, input.resource?.type ?? null, input.resource?.id ?? null)
        .all<Row>()
      if (!result.success) return new Error("failed to list System permission holders")

      const accountIds: AccountId[] = []
      for (const row of result.results) {
        const accountId = zAccountId.safeParse(row.account_id)
        if (!accountId.success) return new Error("invalid System Account ID")
        accountIds.push(accountId.data)
      }

      return Object.freeze(accountIds)
    } catch (caught) {
      return caught instanceof Error
        ? caught
        : new Error("failed to list System permission holders")
    }
  }
}
