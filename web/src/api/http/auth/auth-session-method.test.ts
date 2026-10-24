import { describe, expect, test } from "bun:test"
import { isFreshPasskeySession, readAuthSessionMethod } from "@/api/http/auth/auth-session-method"

describe("readAuthSessionMethod", () => {
  test("パスキーの認証と登録はpasskey", () => {
    expect(readAuthSessionMethod("/passkey/verify-authentication")).toBe("passkey")
    expect(readAuthSessionMethod("/passkey/verify-registration")).toBe("passkey")
  })

  test("デバイス認証のtoken交換はdevice", () => {
    expect(readAuthSessionMethod("/device/token")).toBe("device")
  })

  test("それ以外の経路や不明な経路は拒否する", () => {
    expect(readAuthSessionMethod("/sign-in/email")).toBeNull()
    expect(readAuthSessionMethod("/sign-in/anonymous")).toBeNull()
    expect(readAuthSessionMethod(undefined)).toBeNull()
  })
})

describe("isFreshPasskeySession", () => {
  const now = new Date("2026-01-01T00:10:00Z")

  test("5分以内にパスキーで作ったセッションだけを新しいとみなす", () => {
    const at = (iso: string) => new Date(iso)
    expect(
      isFreshPasskeySession(
        { createdAt: at("2026-01-01T00:06:00Z"), authenticationMethod: "passkey" },
        now,
      ),
    ).toBe(true)
    expect(
      isFreshPasskeySession(
        { createdAt: at("2026-01-01T00:04:59Z"), authenticationMethod: "passkey" },
        now,
      ),
    ).toBe(false)
    expect(
      isFreshPasskeySession(
        { createdAt: at("2026-01-01T00:09:00Z"), authenticationMethod: "device" },
        now,
      ),
    ).toBe(false)
    expect(
      isFreshPasskeySession(
        { createdAt: at("2026-01-01T00:11:00Z"), authenticationMethod: "passkey" },
        now,
      ),
    ).toBe(false)
  })
})
