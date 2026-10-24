import { createMcpGrantToken } from "@system/lib/auth/create-mcp-grant-token"
import { verifyMcpGrantToken } from "@system/lib/auth/verify-mcp-grant-token"
import { describe, expect, test } from "bun:test"
import { signJwtToken } from "@system/lib/auth/sign-jwt-token"

const SECRET = "test-jwt-secret-value"
const GRANT_TOKEN_MAX_AGE_SECONDS = 120

describe("mcp-grant-token", () => {
  test("発行したトークンを検証するとAccount世代とchallengeが復元できる", async () => {
    const token = await createMcpGrantToken(
      "50ea5eee-5cb5-4870-911a-e57ee3f7a81a",
      3,
      "challenge-abc",
      SECRET,
    )

    const payload = await verifyMcpGrantToken(token, SECRET)

    expect(payload).not.toBeInstanceOf(Error)

    if (payload instanceof Error) {
      return
    }

    expect(payload.accountId).toBe("50ea5eee-5cb5-4870-911a-e57ee3f7a81a")
    expect(payload.tokenVersion).toBe(3)
    expect(payload.challenge).toBe("challenge-abc")
    expect(payload.purpose).toBe("mcp-grant")
  })

  test("有効期限は 120 秒", async () => {
    const token = await createMcpGrantToken(
      "50ea5eee-5cb5-4870-911a-e57ee3f7a81a",
      0,
      "challenge-abc",
      SECRET,
    )

    const payload = await verifyMcpGrantToken(token, SECRET)

    if (payload instanceof Error) {
      throw new Error("unexpected error")
    }

    expect(payload.exp - payload.iat).toBe(GRANT_TOKEN_MAX_AGE_SECONDS)
  })

  test("別の secret で署名されたトークンは拒否する", async () => {
    const token = await createMcpGrantToken(
      "50ea5eee-5cb5-4870-911a-e57ee3f7a81a",
      0,
      "challenge-abc",
      "another-test-secret-value",
    )

    expect(await verifyMcpGrantToken(token, SECRET)).toBeInstanceOf(Error)
  })

  test("改竄したトークンは拒否する", async () => {
    const token = await createMcpGrantToken(
      "50ea5eee-5cb5-4870-911a-e57ee3f7a81a",
      0,
      "challenge-abc",
      SECRET,
    )
    const tampered = `${token.slice(0, -4)}AAAA`

    expect(await verifyMcpGrantToken(tampered, SECRET)).toBeInstanceOf(Error)
  })

  test("期限切れのトークンは拒否する", async () => {
    const expiredAt = Math.floor(Date.now() / 1000) - 10

    const token = await signJwtToken(
      {
        userId: "50ea5eee-5cb5-4870-911a-e57ee3f7a81a",
        challenge: "challenge-abc",
        purpose: "mcp-grant",
        exp: expiredAt,
        iat: expiredAt - GRANT_TOKEN_MAX_AGE_SECONDS,
      },
      SECRET,
      "mcp-grant+jwt",
    )

    expect(await verifyMcpGrantToken(token, SECRET)).toBeInstanceOf(Error)
  })

  /**
   * grant とセッション JWT は同じ JWT_SECRET・同じ HS256 で署名するため、purpose を見ないと
   * 署名検証だけで通ってしまう。session トークンを grant として持ち込む取り違えを塞ぐ回帰テスト。
   */
  test("セッショントークンを grant として持ち込んでも拒否する", async () => {
    const nowSeconds = Math.floor(Date.now() / 1000)
    const sessionToken = await signJwtToken(
      {
        sub: "50ea5eee-5cb5-4870-911a-e57ee3f7a81a",
        ver: 0,
        purpose: "web-session",
        iss: "system",
        aud: "system-web",
        exp: nowSeconds + 120,
        iat: nowSeconds,
      },
      SECRET,
      "at+jwt",
    )

    expect(await verifyMcpGrantToken(sessionToken, SECRET)).toBeInstanceOf(Error)
  })

  test("purpose が異なるトークンは拒否する", async () => {
    const nowSeconds = Math.floor(Date.now() / 1000)

    const token = await signJwtToken(
      {
        userId: "50ea5eee-5cb5-4870-911a-e57ee3f7a81a",
        challenge: "challenge-abc",
        purpose: "other-purpose",
        exp: nowSeconds + 120,
        iat: nowSeconds,
      },
      SECRET,
      "mcp-grant+jwt",
    )

    expect(await verifyMcpGrantToken(token, SECRET)).toBeInstanceOf(Error)
  })

  /**
   * alg=none は JWT 実装の古典的な検証回避。署名部を空にした自作トークンで
   * 任意ユーザーの grant を偽造できないことを固定する。
   */
  test("alg=none で署名を外した偽造トークンは拒否する", async () => {
    const nowSeconds = Math.floor(Date.now() / 1000)

    const header = btoa(JSON.stringify({ alg: "none", typ: "JWT" }))
      .replaceAll("+", "-")
      .replaceAll("/", "_")
      .replaceAll("=", "")

    const payload = btoa(
      JSON.stringify({
        userId: "e07db87f-636f-45f2-a7fc-757c52ee9784",
        challenge: "challenge-abc",
        purpose: "mcp-grant",
        exp: nowSeconds + 120,
        iat: nowSeconds,
      }),
    )
      .replaceAll("+", "-")
      .replaceAll("/", "_")
      .replaceAll("=", "")

    expect(await verifyMcpGrantToken(`${header}.${payload}.`, SECRET)).toBeInstanceOf(Error)
  })

  /**
   * challenge が空文字だと PKCE 照合が「空 verifier のハッシュ」と一致しさえすれば通り、
   * verifier を知らない相手でも交換できてしまう。schema の min(1) で入口を塞いでいることを固定する。
   */
  test("challenge が空のトークンは拒否する", async () => {
    const nowSeconds = Math.floor(Date.now() / 1000)

    const token = await signJwtToken(
      {
        userId: "50ea5eee-5cb5-4870-911a-e57ee3f7a81a",
        challenge: "",
        purpose: "mcp-grant",
        exp: nowSeconds + 120,
        iat: nowSeconds,
      },
      SECRET,
    )

    expect(await verifyMcpGrantToken(token, SECRET)).toBeInstanceOf(Error)
  })
})
