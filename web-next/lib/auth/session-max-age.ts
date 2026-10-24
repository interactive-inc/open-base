import { z } from "zod"

const jwtPayloadSchema = z.object({ exp: z.number() })

/** exp を読めないとき（非 JWT・payload 不正・exp 欠落）のフォールバック（従来値の 8 時間）。 */
const fallbackSeconds = 60 * 60 * 8

/**
 * exp は読めたが既に期限切れのときの maxAge（秒）。8 時間の cookie を立てると
 * 失効トークンで API が 401 を返し続け、ログインへ飛ばされる無意味な状態になるため、
 * 即時失効に近い 1 秒にする。
 */
const expiredSeconds = 1

/**
 * session cookie の maxAge を JWT の exp（秒）から算出する。
 * API 側で JWT 寿命を変えても cookie が追従し、「cookie 有効・JWT 失効」の窓を作らない。
 * 署名は検証しない（直前にログイン API から受け取った自分のトークンの exp を読むだけ）。
 */
export function sessionMaxAge(token: string): number {
  const payloadSegment = token.split(".").at(1)

  if (payloadSegment === undefined) {
    return fallbackSeconds
  }

  try {
    const payloadText = Buffer.from(payloadSegment, "base64url").toString("utf8")

    const parsed = jwtPayloadSchema.safeParse(JSON.parse(payloadText))

    if (parsed.success === false) {
      return fallbackSeconds
    }

    const remainingSeconds = parsed.data.exp - Math.floor(Date.now() / 1000)

    // 読めたが期限切れ（<= 0）と、そもそも読めない（fallback）は性質が違うので分ける。
    return remainingSeconds > 0 ? remainingSeconds : expiredSeconds
  } catch {
    return fallbackSeconds
  }
}
