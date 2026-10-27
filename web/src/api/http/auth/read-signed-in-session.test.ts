import { describe, expect, test } from "bun:test"
import { readSignedInSession } from "@/api/http/auth/read-signed-in-session"

const base = {
  id: "session-1",
  userId: "0190a8f0-0000-7000-8000-000000000001",
  createdAt: new Date("2026-01-01T00:00:00Z"),
  expiresAt: new Date("2026-01-08T00:00:00Z"),
  accountTokenVersion: 0,
  authenticationMethod: "passkey",
}

describe("readSignedInSession", () => {
  test("パスキーのセッションをSystemへ渡す形にする", () => {
    expect(readSignedInSession({ session: base })).toEqual({
      accountId: base.userId,
      sessionId: "session-1",
      authenticatedAt: base.createdAt,
      createdAt: base.createdAt,
      expiresAt: base.expiresAt,
      method: "passkey",
      accountTokenVersion: 0,
    })
  })

  test("OIDCのセッションは、IdPでの認証時刻を認証の時刻にする", () => {
    const authenticatedAt = new Date("2025-12-31T23:59:00Z")
    expect(
      readSignedInSession({
        session: {
          ...base,
          authenticationMethod: "oidc",
          authenticatedAt: authenticatedAt.getTime(),
        },
      }),
    ).toMatchObject({ method: "oidc", authenticatedAt })
  })

  test("配備で選んでいない方式の既存セッションを受け付けない", () => {
    expect(readSignedInSession({ session: base }, "password")).toBeNull()
    expect(readSignedInSession({ session: base }, null)).toBeNull()
    expect(readSignedInSession({ session: base }, "passkey")).not.toBeNull()
  })

  test("セッションが無ければnull", () => {
    expect(readSignedInSession(null)).toBeNull()
  })

  test("認証方式かtoken版が無いセッションは使わない", () => {
    expect(
      readSignedInSession({ session: { ...base, authenticationMethod: undefined } }),
    ).toBeNull()
    expect(readSignedInSession({ session: { ...base, authenticationMethod: "email" } })).toBeNull()
    expect(readSignedInSession({ session: { ...base, accountTokenVersion: null } })).toBeNull()
    expect(readSignedInSession({ session: { ...base, accountTokenVersion: -1 } })).toBeNull()
  })
})
