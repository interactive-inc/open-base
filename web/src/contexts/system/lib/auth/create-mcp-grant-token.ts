import { signJwtToken } from "@system/lib/auth/sign-jwt-token"

const MAX_AGE_SECONDS = 120

/** 一回限りのMCP grant tokenを発行する。 */
export async function createMcpGrantToken(
  accountId: string,
  tokenVersion: number,
  challenge: string,
  secret: string,
): Promise<string> {
  const nowSeconds = Math.floor(Date.now() / 1000)
  return signJwtToken(
    {
      accountId,
      tokenVersion,
      challenge,
      purpose: "mcp-grant",
      iss: "system",
      aud: "system-mcp",
      jti: crypto.randomUUID(),
      exp: nowSeconds + MAX_AGE_SECONDS,
      iat: nowSeconds,
    },
    secret,
    "mcp-grant+jwt",
  )
}
