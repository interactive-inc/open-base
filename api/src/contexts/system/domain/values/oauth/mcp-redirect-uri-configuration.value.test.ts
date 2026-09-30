import { describe, expect, test } from "bun:test"
import { McpRedirectUriConfigurationValue } from "@system/domain/values/oauth/mcp-redirect-uri-configuration.value"

const restored = McpRedirectUriConfigurationValue.restore({
  productionRedirectUris: ["https://connector.example/callback"],
  localHostnames: ["localhost", "127.0.0.1"],
  callbackPath: "/callback",
})

if (restored instanceof Error) throw restored
const configuration = restored

const isAllowedMcpRedirectUri = (value: string) => configuration.isAllowed(value)

describe("McpRedirectUriConfigurationValue", () => {
  test("本番の MCP callback を許可する", () => {
    expect(isAllowedMcpRedirectUri("https://connector.example/callback")).toBe(true)
  })

  test("ローカル開発の任意ポートを許可する", () => {
    expect(isAllowedMcpRedirectUri("http://localhost:8976/callback")).toBe(true)
    expect(isAllowedMcpRedirectUri("http://127.0.0.1:33221/callback")).toBe(true)
    expect(isAllowedMcpRedirectUri("http://localhost/callback")).toBe(true)
  })

  test("許可外のホストを拒否する", () => {
    expect(isAllowedMcpRedirectUri("https://evil.example.com/callback")).toBe(false)
  })

  /** 接尾辞一致で許可判定すると通ってしまう典型パターン。完全一致で弾けていることを固定する。 */
  test("ホスト名の接尾辞一致を悪用した偽装を拒否する", () => {
    expect(isAllowedMcpRedirectUri("http://evil-localhost/callback")).toBe(false)
    expect(isAllowedMcpRedirectUri("http://localhost.evil.com/callback")).toBe(false)
    expect(isAllowedMcpRedirectUri("https://connector.example.evil.com/callback")).toBe(false)
  })

  /** 本番ドメインは登録済み URI の完全一致。scheme 差し替え・パス変更で広げられないこと。 */
  test("本番ドメインでもパスや scheme が違えば拒否する", () => {
    expect(isAllowedMcpRedirectUri("https://connector.example/evil")).toBe(false)
    expect(isAllowedMcpRedirectUri("http://connector.example/callback")).toBe(false)
    expect(isAllowedMcpRedirectUri("https://connector.example/callback/../evil")).toBe(false)
    expect(isAllowedMcpRedirectUri("https://unknown.example/callback")).toBe(false)
  })

  test("localhost でもパスが /callback でなければ拒否する", () => {
    expect(isAllowedMcpRedirectUri("http://localhost:8976/evil")).toBe(false)
    expect(isAllowedMcpRedirectUri("http://localhost:8976/")).toBe(false)
  })

  test("localhost の https は許可しない (開発用の http のみ)", () => {
    expect(isAllowedMcpRedirectUri("https://localhost:8976/callback")).toBe(false)
  })

  test("query や fragment 付きは拒否する", () => {
    expect(isAllowedMcpRedirectUri("http://localhost:8976/callback?next=https://evil.com")).toBe(
      false,
    )
    expect(isAllowedMcpRedirectUri("http://localhost:8976/callback#evil")).toBe(false)
  })

  test("javascript: など別 scheme を拒否する", () => {
    expect(isAllowedMcpRedirectUri("javascript:alert(1)")).toBe(false)
    expect(isAllowedMcpRedirectUri("data:text/html,evil")).toBe(false)
  })

  test("空文字や URL として壊れた値を拒否する", () => {
    expect(isAllowedMcpRedirectUri("")).toBe(false)
    expect(isAllowedMcpRedirectUri("not a url")).toBe(false)
    expect(isAllowedMcpRedirectUri("/callback")).toBe(false)
  })
})
