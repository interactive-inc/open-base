import { SignJWT, type JWTPayload } from "jose"

/** HS256でSystem JWTを署名する。 */
export function signJwtToken(payload: JWTPayload, secret: string, type = "JWT"): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256", typ: type })
    .sign(new TextEncoder().encode(secret))
}
