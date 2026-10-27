import type { SystemD1Context } from "@system/configuration/system-context"
import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import type { IamRoleId } from "@system/domain/schemas/iam/iam-role.schema"
import type { IdentityId } from "@system/domain/schemas/identity/identity-id.schema"
import type { IdentityProvider } from "@system/domain/schemas/identity/identity-provider.schema"
import { SystemAccountProvisioningAdapter } from "@system/infrastructure/adapters/identity/system-account-provisioning.adapter"

export type SystemAccountProvisioningInput = Readonly<{
  actorAccountId: AccountId | null
  email: string
  roleId: IamRoleId
  now: Date
}> &
  (
    | Readonly<{ provider: "passkey"; subject?: never; passwordHash?: never }>
    | Readonly<{
        provider: Exclude<IdentityProvider, "passkey">
        subject: string
        passwordHash: string | null
      }>
  )

export type SystemAccountProvisioning = Readonly<{
  accountId: AccountId
  identityId: IdentityId
  accountStatement: D1PreparedStatement
  identityStatements: ReadonlyArray<D1PreparedStatement>
}>

/** Accountと関連するIdentity・Roleを、呼び出し側の変更と同じbatchに載せる。 */
export function prepareSystemAccountProvisioning(
  context: SystemD1Context,
  input: SystemAccountProvisioningInput,
): SystemAccountProvisioning | Error {
  return new SystemAccountProvisioningAdapter(context).prepare(input)
}
