import { describe, expect, test } from "bun:test"
import {
  isFreshSignInSession,
  readAuthSessionMethod,
  readSessionAuthenticatedAt,
} from "@/api/http/auth/auth-session-method"

describe("readAuthSessionMethod", () => {
  test("パスキーの認証と登録はpasskey", () => {
    expect(readAuthSessionMethod("/passkey/verify-authentication")).toBe("passkey")
    expect(readAuthSessionMethod("/passkey/verify-registration")).toBe("passkey")
  })

  test("OIDCの戻り先はoidc", () => {
    expect(readAuthSessionMethod("/oidc/callback")).toBe("oidc")
  })

  test("デバイス認証のtoken交換はdevice", () => {
    expect(readAuthSessionMethod("/device/token")).toBe("device")
  })

  test("それ以外の経路や不明な経路は拒否する", () => {
    expect(readAuthSessionMethod("/sign-in/email")).toBe("password")
    expect(readAuthSessionMethod("/sign-in/anonymous")).toBeNull()
    expect(readAuthSessionMethod("/oidc/sign-in")).toBeNull()
    expect(readAuthSessionMethod(undefined)).toBeNull()
  })
})

describe("readSessionAuthenticatedAt", () => {
  const createdAt = new Date("2026-01-01T00:10:00Z")

  test("記録が無ければセッションの作成時刻", () => {
    expect(readSessionAuthenticatedAt({ createdAt })).toEqual(createdAt)
  })

  test("IdPでの認証時刻が古ければそれを使い、新しくは扱わない", () => {
    const older = new Date("2026-01-01T00:00:00Z").getTime()
    expect(readSessionAuthenticatedAt({ createdAt, authenticatedAt: older })?.getTime()).toBe(older)
    expect(
      readSessionAuthenticatedAt({ createdAt, authenticatedAt: createdAt.getTime() + 60_000 }),
    ).toEqual(createdAt)
  })
})

describe("isFreshSignInSession", () => {
  const now = new Date("2026-01-01T00:10:00Z")
  const at = (iso: string) => new Date(iso)

  test("5分以内にパスキーかOIDCで作ったセッションだけを新しいとみなす", () => {
    for (const method of ["password", "passkey", "oidc"]) {
      expect(
        isFreshSignInSession(
          {
            createdAt: at("2026-01-01T00:06:00Z"),
            authenticationMethod: method,
            authenticatedAt: at("2026-01-01T00:06:00Z").getTime(),
          },
          now,
        ),
      ).toBe(true)
      expect(
        isFreshSignInSession(
          {
            createdAt: at("2026-01-01T00:04:59Z"),
            authenticationMethod: method,
            authenticatedAt: at("2026-01-01T00:06:00Z").getTime(),
          },
          now,
        ),
      ).toBe(false)
    }
    expect(
      isFreshSignInSession(
        { createdAt: at("2026-01-01T00:09:00Z"), authenticationMethod: "device" },
        now,
      ),
    ).toBe(false)
    expect(
      isFreshSignInSession(
        { createdAt: at("2026-01-01T00:11:00Z"), authenticationMethod: "passkey" },
        now,
      ),
    ).toBe(false)
  })

  test("IdPの認証時刻が無ければ、今回のセッション発行を再認証の証拠にしない", () => {
    expect(isFreshSignInSession({ createdAt: now, authenticationMethod: "oidc" }, now)).toBe(false)
    expect(readSessionAuthenticatedAt({ createdAt: now, authenticationMethod: "oidc" })).toBeNull()
  })

  test("IdPでの認証が古ければ、セッションが新しくても新しいとみなさない", () => {
    expect(
      isFreshSignInSession(
        {
          createdAt: at("2026-01-01T00:09:00Z"),
          authenticationMethod: "oidc",
          authenticatedAt: at("2026-01-01T00:00:00Z").getTime(),
        },
        now,
      ),
    ).toBe(false)
  })
})
