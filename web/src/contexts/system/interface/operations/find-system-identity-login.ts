import { SystemIdentityLoginAdapter } from "@system/infrastructure/adapters/auth/system-identity-login.adapter"

/** activeなIdentity bindingとSystem Accountだけを一つのlogin snapshotとして読む。 */
export function findSystemIdentityLogin(
  context: ConstructorParameters<typeof SystemIdentityLoginAdapter>[0],
  ...input: Parameters<SystemIdentityLoginAdapter["find"]>
): ReturnType<SystemIdentityLoginAdapter["find"]> {
  return new SystemIdentityLoginAdapter(context).find(...input)
}
