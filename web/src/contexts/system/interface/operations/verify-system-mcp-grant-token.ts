import { verifyMcpGrantToken } from "@system/lib/auth/verify-mcp-grant-token"

/** Systemが所有する検証・生成処理を公開操作として実行する。 */
export function verifySystemMcpGrantToken(...input: Parameters<typeof verifyMcpGrantToken>) {
  return verifyMcpGrantToken(...input)
}
