import { describe, expect, test } from "bun:test"
import { sameOriginPath } from "@/api/http/auth/same-origin-path"
import { readOidcConfiguration, readSignInMethod } from "@/api/http/auth/sign-in-method"

describe("readSignInMethod", () => {
  test("未設定ならpasskey", () => {
    expect(readSignInMethod({})).toBe("passkey")
    expect(readSignInMethod({ SIGN_IN_METHOD: "" })).toBe("passkey")
  })

  test("password・passkey・oidcを選べる", () => {
    expect(readSignInMethod({ SIGN_IN_METHOD: "password" })).toBe("password")
    expect(readSignInMethod({ SIGN_IN_METHOD: "passkey" })).toBe("passkey")
    expect(readSignInMethod({ SIGN_IN_METHOD: "oidc" })).toBe("oidc")
  })

  test("知らない値はどちらも使わせない", () => {
    expect(readSignInMethod({ SIGN_IN_METHOD: "unknown" })).toBeNull()
    expect(readSignInMethod({ SIGN_IN_METHOD: "OIDC" })).toBeNull()
  })
})

describe("readOidcConfiguration", () => {
  const env = { IDENTITY_ISSUER: "https://id.example.com", OIDC_CLIENT_ID: "web-client" }

  test("発行者とclient IDを読む", () => {
    expect(readOidcConfiguration(env)).toEqual({
      issuer: "https://id.example.com",
      clientId: "web-client",
      clientSecret: null,
      excludedAudiences: [],
    })
  })

  test("足りない、またはHTTPSでない設定は使わない", () => {
    expect(readOidcConfiguration({ IDENTITY_ISSUER: env.IDENTITY_ISSUER })).toBeNull()
    expect(readOidcConfiguration({ OIDC_CLIENT_ID: "web-client" })).toBeNull()
    expect(readOidcConfiguration({ ...env, IDENTITY_ISSUER: "http://id.example.com" })).toBeNull()
    expect(readOidcConfiguration({ ...env, IDENTITY_ISSUER: "not a url" })).toBeNull()
    expect(
      readOidcConfiguration({ ...env, IDENTITY_ISSUER: "http://localhost.example.com" }),
    ).toBeNull()
  })

  test("開発用のloopbackの発行者だけはHTTPでも使える", () => {
    expect(
      readOidcConfiguration({ ...env, IDENTITY_ISSUER: "http://localhost:9000" })?.issuer,
    ).toBe("http://localhost:9000")
  })

  test("client IDがAPI用のaudと同じなら使わない", () => {
    expect(
      readOidcConfiguration({ ...env, IDENTITY_ACCESS_TOKEN_AUDIENCE: "web-client" }),
    ).toBeNull()
    expect(
      readOidcConfiguration({ ...env, SERVICE_BINDING_ACCESS_TOKEN_AUDIENCE: "web-client" }),
    ).toBeNull()
  })
})

describe("sameOriginPath", () => {
  test("同じoriginの経路だけを戻り先にする", () => {
    expect(sameOriginPath("/device?user_code=AB")).toBe("/device?user_code=AB")
    expect(sameOriginPath(undefined)).toBe("/")
    expect(sameOriginPath("https://evil.example.com")).toBe("/")
    expect(sameOriginPath("//evil.example.com")).toBe("/")
    expect(sameOriginPath("/\\evil.example.com")).toBe("/")
  })
})
