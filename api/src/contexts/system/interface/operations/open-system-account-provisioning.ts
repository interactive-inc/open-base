import { SystemAccountProvisioningAdapter } from "@system/infrastructure/adapters/identity/system-account-provisioning.adapter"

/** 新規Account・Identity・Role Bindingを一つのSystem変更単位として準備する口を開く。 */
export function openSystemAccountProvisioning(
  context: ConstructorParameters<typeof SystemAccountProvisioningAdapter>[0],
): SystemAccountProvisioningAdapter {
  return new SystemAccountProvisioningAdapter(context)
}
