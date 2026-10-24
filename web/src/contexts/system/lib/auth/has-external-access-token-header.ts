import { decodeProtectedHeader } from "jose"

export function hasExternalAccessTokenHeader(token: string): boolean {
  try {
    const header = decodeProtectedHeader(token)
    return header.alg === "EdDSA" && header.typ === "at+jwt"
  } catch {
    return false
  }
}
