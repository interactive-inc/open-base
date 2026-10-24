import { describe, expect, test } from "vite-plus/test"
import { identityLoginCookieNames } from "@/lib/auth/identity-login-cookie-names"

describe("identityLoginCookieNames", () => {
  test("HTTPSでは__Host- prefixを付ける", () => {
    expect(identityLoginCookieNames("https://app.example.com/auth/callback", "state-1")).toEqual({
      state: "__Host-identity_login_state_state-1",
      verifier: "__Host-identity_login_verifier_state-1",
      stepUpReturn: "__Host-identity_step_up_return_state-1",
    })
  })

  test("ローカルHTTPではprefixを付けない", () => {
    expect(identityLoginCookieNames("http://localhost:3000/auth/callback", "state-1")).toEqual({
      state: "identity_login_state_state-1",
      verifier: "identity_login_verifier_state-1",
      stepUpReturn: "identity_step_up_return_state-1",
    })
  })

  test("stateごとにCookie名を分ける", () => {
    const first = identityLoginCookieNames("https://app.example.com/auth/callback", "first")
    const second = identityLoginCookieNames("https://app.example.com/auth/callback", "second")

    expect(first).not.toEqual(second)
  })
})
