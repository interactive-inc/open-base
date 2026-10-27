import { z } from "zod"
import { ApiError } from "@/lib/errors"
import { apiUrl } from "@/lib/http/api-url"

/** CLIがBetter Authのデバイス認証で名乗るclient ID。サーバーと同じ値にする。 */
export const BASE_CLI_CLIENT_ID = "base-cli"

const DEVICE_CODE_GRANT = "urn:ietf:params:oauth:grant-type:device_code"

const zDeviceCode = z.object({
  device_code: z.string().min(1),
  user_code: z.string().min(1),
  verification_uri: z.string().min(1),
  verification_uri_complete: z.string().min(1).optional(),
  expires_in: z.number().positive(),
  interval: z.number().positive().optional(),
})

export type DeviceAuthorization = Readonly<{
  deviceCode: string
  userCode: string
  /** ブラウザで開くURL。コードを含む。 */
  verificationUrl: string
  expiresAt: number
  intervalMilliseconds: number
}>

/** デバイス認証を始める。返したURLをブラウザで開き、サインインし直して承認してもらう。 */
export async function startDeviceLogin(baseUrl: string): Promise<DeviceAuthorization> {
  const response = await fetch(apiUrl("/auth/device/code", baseUrl), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ client_id: BASE_CLI_CLIENT_ID }),
    signal: AbortSignal.timeout(15_000),
  })
  if (!response.ok)
    throw new ApiError(response.status, `ERR ${response.status} ${await response.text()}`)
  const code = zDeviceCode.parse(await response.json())
  const verificationUrl = new URL(code.verification_uri_complete ?? code.verification_uri, baseUrl)
  if (code.verification_uri_complete === undefined) {
    verificationUrl.searchParams.set("user_code", code.user_code)
  }
  return Object.freeze({
    deviceCode: code.device_code,
    userCode: code.user_code,
    verificationUrl: verificationUrl.toString(),
    expiresAt: Date.now() + code.expires_in * 1_000,
    intervalMilliseconds: (code.interval ?? 5) * 1_000,
  })
}

/**
 * 承認されるまでtokenの交換を繰り返す。承認されればセッションtokenを返す。
 * 拒否や期限切れは ApiError にする。待ち時間はサーバーが指定した間隔に従う。
 */
export async function waitForDeviceLogin(
  baseUrl: string,
  authorization: DeviceAuthorization,
  sleep: (milliseconds: number) => Promise<void> = (milliseconds) => Bun.sleep(milliseconds),
): Promise<string> {
  let interval = authorization.intervalMilliseconds
  while (Date.now() < authorization.expiresAt) {
    await sleep(interval)
    const response = await fetch(apiUrl("/auth/device/token", baseUrl), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        grant_type: DEVICE_CODE_GRANT,
        device_code: authorization.deviceCode,
        client_id: BASE_CLI_CLIENT_ID,
      }),
      signal: AbortSignal.timeout(15_000),
    })
    const body: unknown = await response.json().catch(() => ({}))
    if (response.ok) return z.object({ access_token: z.string().min(1) }).parse(body).access_token
    const error = z.object({ error: z.string() }).safeParse(body)
    const code = error.success ? error.data.error : ""
    if (code === "authorization_pending") continue
    if (code === "slow_down") {
      interval += 5_000
      continue
    }
    if (code === "access_denied") throw new ApiError(response.status, "ログインは拒否されました")
    if (code === "expired_token") break
    throw new ApiError(response.status, `ERR ${response.status} ${JSON.stringify(body)}`)
  }
  throw new ApiError(400, "ログインの期限が切れました。もう一度 base login を実行してください")
}
