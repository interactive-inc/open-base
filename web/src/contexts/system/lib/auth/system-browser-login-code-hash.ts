import { systemLoginCodeHash } from "@system/lib/auth/system-login-code-hash"

/** 用途と版を固定し、発行元Sessionを保証しない旧方式のcodeと交換させない。 */
export async function systemBrowserLoginCodeHash(rawCode: string): Promise<string | Error> {
  return systemLoginCodeHash(`system:browser-login-code:v2\0${rawCode}`)
}
