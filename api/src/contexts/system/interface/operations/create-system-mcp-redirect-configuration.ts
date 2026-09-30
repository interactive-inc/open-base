import { McpRedirectUriConfigurationValue } from "@system/domain/values/oauth/mcp-redirect-uri-configuration.value"

/** Systemが所有する値を検証・生成する。 */
export function createSystemMcpRedirectConfiguration(
  ...input: Parameters<typeof McpRedirectUriConfigurationValue.restore>
) {
  return McpRedirectUriConfigurationValue.restore(...input)
}
