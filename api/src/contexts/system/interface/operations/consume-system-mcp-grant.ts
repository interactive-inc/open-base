import type { SystemD1Context } from "@system/configuration/system-context"
import { RecordSystemIdentityLoginTokenAdapter } from "@system/infrastructure/adapters/auth/record-system-identity-login-token.adapter"
import type { McpGrantPayload } from "@system/lib/auth/verify-mcp-grant-token"

/** 外部Identity tokenのjtiと同じ表に記録するため、MCP grantのjtiを名前空間で分ける。 */
const MCP_GRANT_JTI_NAMESPACE = "mcp-grant:"

/**
 * 検証済みのMCP grantを原子的に使用済みにする。
 *
 * 署名・期限・purpose・PKCE verifier・Accountの有効性を確かめた後、セッションを作る前に呼ぶ。
 * 記録はgrantの期限までだけ意味を持つ。期限を過ぎたgrantは署名の検査で拒否されるため、
 * 期限後に記録が消えても再利用はできない。
 */
export async function consumeSystemMcpGrant(
  context: SystemD1Context,
  input: Readonly<{ grant: Pick<McpGrantPayload, "jti" | "exp">; now: Date }>,
): Promise<"consumed" | "replayed" | Error> {
  const recorded = await new RecordSystemIdentityLoginTokenAdapter(
    context,
  ).recordSystemIdentityLoginToken({
    jti: `${MCP_GRANT_JTI_NAMESPACE}${input.grant.jti}`,
    expiresAt: new Date(input.grant.exp * 1_000),
    usedAt: input.now,
  })
  return recorded === "recorded" ? "consumed" : recorded
}
