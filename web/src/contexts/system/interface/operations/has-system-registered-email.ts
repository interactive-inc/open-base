import type { SystemD1Context } from "@system/configuration/system-context"
import { SystemAccountProvisioningAdapter } from "@system/infrastructure/adapters/identity/system-account-provisioning.adapter"

/** 有効化の前後や失効状態によらず、登録済みメールの重複を調べる。 */
export function hasSystemRegisteredEmail(
  context: SystemD1Context,
  email: string,
): Promise<boolean | Error> {
  return new SystemAccountProvisioningAdapter(context).hasRegisteredEmail(email)
}
