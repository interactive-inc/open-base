import { InvalidOidcClientRegistryError } from "@system/domain/errors"
import { OidcClientRegistryValue } from "@system/domain/values/oauth/oidc-client-registry.value"
import { describe, expect, test } from "bun:test"

const registryProps = {
  "https://issuer.example": [
    {
      id: "web-client",
      name: "Web client",
      redirectUris: ["https://client.example/callback"],
    },
  ],
}

function restore(input: unknown): OidcClientRegistryValue {
  const registry = OidcClientRegistryValue.restore(input)
  if (registry instanceof Error) throw registry
  return registry
}

describe("OidcClientRegistryValue", () => {
  test("resolves only an exact issuer, client, and redirect URI", () => {
    const registry = restore(registryProps)
    expect(
      registry.resolve({
        issuer: "https://issuer.example",
        clientId: "web-client",
        redirectUri: "https://client.example/callback",
      }),
    ).toEqual({
      id: "web-client",
      name: "Web client",
      redirectUris: ["https://client.example/callback"],
    })
    expect(
      registry.resolve({
        issuer: "https://issuer.example",
        clientId: "web-client",
        redirectUri: "https://client.example/callback/extra",
      }),
    ).toBeNull()
    expect(
      registry.resolve({
        issuer: "https://unknown.example",
        clientId: "web-client",
        redirectUri: "https://client.example/callback",
      }),
    ).toBeNull()
  })

  test("detaches and freezes its snapshot from mutable input", () => {
    const redirectUris = ["https://client.example/callback"]
    const client = { id: "web-client", name: "Web client", redirectUris }
    const registry = restore({ "https://issuer.example": [client] })
    const resolved = registry.resolve({
      issuer: "https://issuer.example",
      clientId: "web-client",
      redirectUri: redirectUris[0]!,
    })
    expect(resolved).not.toBeNull()
    if (resolved === null) return

    client.name = "Changed"
    redirectUris[0] = "https://attacker.example/callback"
    expect(resolved.name).toBe("Web client")
    expect(resolved.redirectUris).toEqual(["https://client.example/callback"])
    expect(Object.isFrozen(resolved)).toBe(true)
    expect(Object.isFrozen(resolved.redirectUris)).toBe(true)
  })

  test("rejects duplicate clients, duplicate redirects, and unsafe redirects", () => {
    const client = registryProps["https://issuer.example"][0]!
    expect(
      OidcClientRegistryValue.restore({
        "https://issuer.example": [client, { ...client }],
      }),
    ).toBeInstanceOf(InvalidOidcClientRegistryError)
    expect(
      OidcClientRegistryValue.restore({
        "https://issuer.example": [
          {
            ...client,
            redirectUris: ["https://client.example/callback", "https://client.example/callback"],
          },
        ],
      }),
    ).toBeInstanceOf(InvalidOidcClientRegistryError)
    expect(
      OidcClientRegistryValue.restore({
        "https://issuer.example": [{ ...client, redirectUris: ["http://client.example/callback"] }],
      }),
    ).toBeInstanceOf(InvalidOidcClientRegistryError)
  })

  test("allows an exact registered loopback HTTP redirect", () => {
    const registry = restore({
      "https://issuer.example": [
        {
          id: "native-client",
          name: "Native client",
          redirectUris: ["http://127.0.0.1:34567/callback"],
        },
      ],
    })
    expect(
      registry.resolve({
        issuer: "https://issuer.example",
        clientId: "native-client",
        redirectUri: "http://127.0.0.1:34567/callback",
      }),
    ).not.toBeNull()
  })

  test("rejects accessor-backed input without executing getters", () => {
    let getterCalls = 0
    const accessorRegistry = Object.create(null) as Record<string, unknown>
    Object.defineProperty(accessorRegistry, "https://issuer.example", {
      enumerable: true,
      get: () => {
        getterCalls += 1
        return registryProps["https://issuer.example"]
      },
    })
    const accessorClient = {
      name: "Accessor client",
      redirectUris: ["https://client.example/callback"],
    }
    Object.defineProperty(accessorClient, "id", {
      enumerable: true,
      get: () => {
        getterCalls += 1
        return "web-client"
      },
    })

    expect(OidcClientRegistryValue.restore(accessorRegistry)).toBeInstanceOf(
      InvalidOidcClientRegistryError,
    )
    expect(
      OidcClientRegistryValue.restore({ "https://issuer.example": [accessorClient] }),
    ).toBeInstanceOf(InvalidOidcClientRegistryError)
    expect(getterCalls).toBe(0)
  })
})
