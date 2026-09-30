import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { SystemRoleBindingRepository } from "@system/infrastructure/repositories/iam/system-role-binding.repository"

/** Accountの有効なresource bindingを、他contextへ内部tableを渡さず返す。 */
export async function listSystemAccountResourceIds(
  input: Readonly<{
    database: D1Database
    accountId: string
    resourceType: string
  }>,
): Promise<ReadonlyArray<string> | Error> {
  const accountId = zAccountId.safeParse(input.accountId)
  if (
    !accountId.success ||
    !/^[a-z][a-z0-9_]*(?::[a-z][a-z0-9_]*)+$/.test(input.resourceType) ||
    input.resourceType.length > 100
  ) {
    return new Error("Invalid System resource binding query")
  }

  const bindings = await new SystemRoleBindingRepository({ env: { DB: input.database } }).findMany(
    accountId.data,
  )
  if (bindings instanceof Error) return bindings

  return Object.freeze(
    bindings.flatMap((binding) =>
      binding.revokedAt === null && binding.resource?.type === input.resourceType
        ? [binding.resource.id]
        : [],
    ),
  )
}
