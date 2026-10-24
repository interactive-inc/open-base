import {
  OidcIssuerConfigurationValue,
  type OidcIssuerConfiguration,
} from "@system/domain/values/oauth/oidc-issuer-configuration.value"
import { describe, expect, test } from "bun:test"

const configuration: OidcIssuerConfiguration = {
  issuersByHostname: {
    "issuer.example": "https://issuer.example",
    "issuer.example.localhost": "https://issuer.example.localhost",
  },
  localProxyHostnames: ["127.0.0.1", "localhost", "::1"],
  localIssuerHostname: "issuer.example.localhost",
}

describe("OidcIssuerConfigurationValue", () => {
  test("configurationに登録したcanonical HTTPS hostnameだけをissuerにする", () => {
    const value = new OidcIssuerConfigurationValue(configuration)
    expect(
      value.resolve({
        requestUrl: "https://issuer.example/oauth/authorize",
        forwardedHost: null,
      }),
    ).toBe("https://issuer.example")
    expect(
      value.resolve({
        requestUrl: "http://issuer.example/oauth/authorize",
        forwardedHost: null,
      }),
    ).toBeInstanceOf(Error)
    expect(
      value.resolve({
        requestUrl: "https://preview.example/oauth/authorize",
        forwardedHost: null,
      }),
    ).toBeInstanceOf(Error)
    expect(Object.isFrozen(value)).toBe(true)
  })

  test("明示したloopback proxyから単一のlocal issuerだけを復元する", () => {
    const value = new OidcIssuerConfigurationValue(configuration)
    expect(
      value.resolve({
        requestUrl: "http://127.0.0.1:5173/oauth/authorize",
        forwardedHost: "issuer.example.localhost",
      }),
    ).toBe("https://issuer.example.localhost")
    expect(
      value.resolve({
        requestUrl: "http://127.0.0.1:5173/oauth/authorize",
        forwardedHost: "issuer.example",
      }),
    ).toBeInstanceOf(Error)
  })

  test.each([
    ["comma ambiguity", "issuer.example.localhost, attacker.example"],
    ["userinfo", "user@issuer.example.localhost"],
    ["port", "issuer.example.localhost:444"],
    ["path", "issuer.example.localhost/evil"],
  ])("forwarded authorityの%sをfail closedで拒否する", (_name, forwardedHost) => {
    const value = new OidcIssuerConfigurationValue(configuration)
    expect(
      value.resolve({ requestUrl: "http://127.0.0.1:5173/oauth/authorize", forwardedHost }),
    ).toBeInstanceOf(Error)
  })

  test("壊れたrequest URL・issuer設定・runtime configurationを例外にせず拒否する", () => {
    const value = new OidcIssuerConfigurationValue(configuration)
    expect(value.resolve({ requestUrl: "not a URL", forwardedHost: null })).toBeInstanceOf(Error)
    expect(
      new OidcIssuerConfigurationValue({
        ...configuration,
        issuersByHostname: { "issuer.example": "http://issuer.example" },
      }).resolve({ requestUrl: "https://issuer.example/path", forwardedHost: null }),
    ).toBeInstanceOf(Error)
    expect(
      OidcIssuerConfigurationValue.create({ ...configuration, localProxyHostnames: null }),
    ).toBeInstanceOf(Error)
  })
})
