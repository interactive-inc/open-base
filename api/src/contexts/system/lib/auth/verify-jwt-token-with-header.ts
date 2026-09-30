import { jwtVerify, type JWTVerifyResult } from "jose"

/** protected headerを必要とするSystem JWTをHS256で検証する。 */
export function verifyJwtTokenWithHeader(token: string, secret: string): Promise<JWTVerifyResult> {
  return jwtVerify(token, new TextEncoder().encode(secret), {
    algorithms: ["HS256"],
  })
}
