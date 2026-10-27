import { describe, expect, test } from "bun:test"
import { isEnabledAuthPath, requiresCurrentSession } from "./auth-path-policy"

describe("認証方式の公開範囲", () => {
  const paths = {
    password: "/sign-in/email",
    passkey: "/passkey/verify-authentication",
    oidc: "/oidc/callback",
  } as const
  for (const method of ["password", "passkey", "oidc"] as const) {
    test(`${method}だけでログインでき、資格情報の別経路は公開しない`, () => {
      for (const [kind, path] of Object.entries(paths))
        expect(isEnabledAuthPath(path, method)).toBe(kind === method)
      for (const path of [
        "/sign-up/email",
        "/set-password",
        "/change-password",
        "/reset-password",
        "/sign-in/social",
        "/link-social",
        "/update-user",
        "/change-email",
        "/unknown",
      ]) {
        expect(isEnabledAuthPath(path, method)).toBe(false)
      }
      expect(isEnabledAuthPath("/device/token", method)).toBe(true)
      expect(isEnabledAuthPath("/sign-out", method)).toBe(true)
    })
  }
  test("不正な設定では認証と委任を開始させない", () => {
    for (const path of [...Object.values(paths), "/device/code"])
      expect(isEnabledAuthPath(path, null)).toBe(false)
    expect(isEnabledAuthPath("/sign-out", null)).toBe(true)
  })
  test("資格追加と委任の前に現在のAccountを照合する", () => {
    for (const path of [
      "/passkey/generate-register-options",
      "/passkey/verify-registration",
      "/passkey/delete-passkey",
      "/device/approve",
    ])
      expect(requiresCurrentSession(path)).toBe(true)
    for (const path of Object.values(paths)) expect(requiresCurrentSession(path)).toBe(false)
  })
})
