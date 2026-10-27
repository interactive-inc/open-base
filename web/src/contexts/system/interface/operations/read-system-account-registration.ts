import type { SystemD1Context } from "@system/configuration/system-context"
import type { IdentityProvider } from "@system/domain/schemas/identity/identity-provider.schema"
import { SystemAccountProvisioningAdapter } from "@system/infrastructure/adapters/identity/system-account-provisioning.adapter"

/** 登録の再送を照合する情報。サインインや操作の認可には使わない。 */
export function readSystemAccountRegistration(
  context: SystemD1Context,
  input: Readonly<{
    accountId: string
    roleKey: string
    provider: IdentityProvider
    subject: string | null
  }>,
): Promise<Readonly<{ email: string | null; hasExpectedRole: boolean }> | Error> {
  return new SystemAccountProvisioningAdapter(context).readRegistration(input)
}
