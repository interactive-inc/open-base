import { SystemIdentityByEmailAdapter } from "@system/infrastructure/adapters/identity/system-identity-by-email.adapter"

/** verified emailを持つactive System Identityを検索する。 */
export function findSystemIdentityByEmail(
  context: ConstructorParameters<typeof SystemIdentityByEmailAdapter>[0],
  ...input: Parameters<SystemIdentityByEmailAdapter["execute"]>
): ReturnType<SystemIdentityByEmailAdapter["execute"]> {
  return new SystemIdentityByEmailAdapter(context).execute(...input)
}
