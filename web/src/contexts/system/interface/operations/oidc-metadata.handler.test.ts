import { describe, expect, test } from "bun:test"
import { OIDCTemporarilyUnavailableError } from "@/contexts/system/interface/errors"
import { handleOidcMetadataRequest } from "@/contexts/system/interface/operations/oidc-metadata.handler"
import { OidcIssuerConfigurationValue } from "@system/domain/values/oauth/oidc-issuer-configuration.value"

const issuerConfiguration = new OidcIssuerConfigurationValue({
  issuersByHostname: Object.freeze({ "identity.example.test": "https://identity.example.test" }),
  localProxyHostnames: Object.freeze(["127.0.0.1", "localhost", "::1"]),
  localIssuerHostname: "identity.example.test",
})

const coordinate = "A".repeat(43)
const signingKeysRaw = JSON.stringify({
  active: {
    kty: "EC",
    crv: "P-256",
    x: coordinate,
    y: coordinate,
    d: coordinate,
    kid: "active-key",
    use: "sig",
    alg: "ES256",
  },
  previous: [],
})

describe("OIDC metadata handler", () => {
  test("discoveryと公開鍵だけのJWKSをcanonical issuerで返す", async () => {
    const discovery = handleOidcMetadataRequest({
      request: new Request("https://identity.example.test/.well-known/openid-configuration"),
      signingKeysRaw,
      issuerConfiguration,
    })
    const jwks = handleOidcMetadataRequest({
      request: new Request("https://identity.example.test/.well-known/jwks.json"),
      signingKeysRaw,
      issuerConfiguration,
    })

    expect(discovery?.status).toBe(200)
    expect(await discovery?.json()).toMatchObject({
      issuer: "https://identity.example.test",
      id_token_signing_alg_values_supported: ["ES256"],
    })
    expect(jwks?.headers.get("access-control-allow-origin")).toBe("*")
    expect(await jwks?.text()).not.toContain('"d":')
  })

  test("対象外pathを処理せず、鍵未設定は例外を送出する", () => {
    expect(
      handleOidcMetadataRequest({
        request: new Request("https://identity.example.test/"),
        signingKeysRaw,
        issuerConfiguration,
      }),
    ).toBeNull()
    expect(() =>
      handleOidcMetadataRequest({
        request: new Request("https://identity.example.test/.well-known/jwks.json"),
        signingKeysRaw: undefined,
        issuerConfiguration,
      }),
    ).toThrow(OIDCTemporarilyUnavailableError)
  })
})
