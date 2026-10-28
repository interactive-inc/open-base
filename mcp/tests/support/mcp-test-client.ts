import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"

/** workspace横断のHTTP受入からも、MCP workspaceのSDKで実stdio serverを呼ぶ。 */
export async function createMcpTestClient(input: {
  entry: string
  baseUrl: string
  configDirectory: string
}) {
  const client = new Client({ name: "review-test", version: "1" })
  await client.connect(
    new StdioClientTransport({
      command: process.execPath,
      args: [input.entry],
      env: { ...process.env, BASE_API: input.baseUrl, BASE_CONFIG_DIR: input.configDirectory },
      stderr: "pipe",
    }),
  )
  return client
}
