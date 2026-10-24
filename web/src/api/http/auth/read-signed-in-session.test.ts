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
      expiresAt: base.expiresAt,
      method: "passkey",
      accountTokenVersion: 0,
    })
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
