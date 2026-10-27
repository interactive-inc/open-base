import { verifyJwtTokenWithHeader } from "@system/lib/auth/verify-jwt-token-with-header"
import { z } from "zod"

const grantPayloadSchema = z
  .object({
    accountId: z.string().min(1),
    tokenVersion: z.number().int().nonnegative(),
    challenge: z.string().min(1),
    purpose: z.literal("mcp-grant"),
    iss: z.literal("system"),
    aud: z.literal("system-mcp"),
    jti: z.string().min(1),
    exp: z.number(),
    iat: z.number(),
  })
  .strict()

export type McpGrantPayload = z.infer<typeof grantPayloadSchema>

/** MCP grant tokenの用途・issuer・audience・payloadをfail closedで検証する。 */
export async function verifyMcpGrantToken(
  token: string,
  secret: string,
): Promise<McpGrantPayload | Error> {
  try {
    const verified = await verifyJwtTokenWithHeader(token, secret)
    return verified.protectedHeader.typ === "mcp-grant+jwt"
      ? grantPayloadSchema.parse(verified.payload)
      : new Error("invalid_grant")
  } catch {
    return new Error("invalid_grant")
  }
}
