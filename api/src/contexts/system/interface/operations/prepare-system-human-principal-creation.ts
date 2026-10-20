import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { systemPrincipals } from "@system/infrastructure/schema/system-principal"
import { drizzle } from "drizzle-orm/d1"

/**
 * 人の Account を作る保存 batch に、その Account の Human Principal を作る文を載せる。
 *
 * Human Principal が無い Account は、Human 認可を要求する操作で権限があっても拒否される。
 * 既にある Principal（機械主体を含む）は上書きせず、無いときだけ作る。Account 行より後ろへ置く。
 */
export function prepareSystemHumanPrincipalCreation(
  database: D1Database,
  input: Readonly<{ accountId: string; now: Date }>,
) {
  const accountId = zAccountId.parse(input.accountId)
  return drizzle(database)
    .insert(systemPrincipals)
    .values({
      id: crypto.randomUUID(),
      accountId,
      kind: "human",
      name: accountId,
      connectorId: null,
      revision: 1,
      createdAt: input.now,
      updatedAt: input.now,
    })
    .onConflictDoNothing({ target: systemPrincipals.accountId })
}
