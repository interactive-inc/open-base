import { describe, expect, test } from "bun:test"
import { SystemCliIdentityRedirectUriValue } from "@system/domain/values/oauth/system-cli-identity-redirect-uri.value"

describe("SystemCliIdentityRedirectUriValue", () => {
  test("HTTPS originから固定callbackを作る", () => {
    expect(SystemCliIdentityRedirectUriValue.create("https://api.example.com").toString()).toBe(
      "https://api.example.com/system/cli-authorization-callback",
    )
  })

  test("loopback HTTPを許可する", () => {
    expect(SystemCliIdentityRedirectUriValue.create("http://127.0.0.1:18787").toString()).toBe(
      "http://127.0.0.1:18787/system/cli-authorization-callback",
    )
  })

  test("外部HTTP、path、query、credentialsを拒否する", () => {
    expect(SystemCliIdentityRedirectUriValue.create("http://api.example.com")).toBeInstanceOf(Error)
    expect(SystemCliIdentityRedirectUriValue.create("https://api.example.com/path")).toBeInstanceOf(
      Error,
    )
    expect(
      SystemCliIdentityRedirectUriValue.create("https://api.example.com?mode=1"),
    ).toBeInstanceOf(Error)
    expect(
      SystemCliIdentityRedirectUriValue.create("https://user:pass@api.example.com"),
    ).toBeInstanceOf(Error)
  })
})
