import { startDeviceLogin, waitForDeviceLogin } from "@/lib/auth/device-login"
import { ApiError } from "@/lib/errors"
import { afterEach, describe, expect, test } from "bun:test"

const baseUrl = "https://base.example.test"
const originalFetch = globalThis.fetch

type Reply = Readonly<{ status: number; body: unknown }>

function replyWith(replies: Reply[], seen: Array<{ url: string; body: unknown }>): void {
  globalThis.fetch = Object.assign(
    async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
      const url = input instanceof Request ? input.url : input.toString()
      seen.push({ url, body: JSON.parse(typeof init?.body === "string" ? init.body : "{}") })
      const reply = replies.shift()
      if (reply === undefined) throw new Error("unexpected request")
      return new Response(JSON.stringify(reply.body), {
        status: reply.status,
        headers: { "content-type": "application/json" },
      })
    },
    { preconnect: originalFetch.preconnect },
  )
}

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe("device login", () => {
  test("コードを取得し、承認待ちと間隔の延長を経てセッションtokenを受け取る", async () => {
    const seen: Array<{ url: string; body: unknown }> = []
    replyWith(
      [
        {
          status: 200,
          body: {
            device_code: "device-1",
            user_code: "ABCD-EFGH",
            verification_uri: "/device",
            expires_in: 600,
            interval: 5,
          },
        },
        { status: 400, body: { error: "authorization_pending" } },
        { status: 400, body: { error: "slow_down" } },
        { status: 200, body: { access_token: "session-token", token_type: "Bearer" } },
      ],
      seen,
    )
    const waits: number[] = []

    const authorization = await startDeviceLogin(baseUrl)
    expect(authorization.verificationUrl).toBe(`${baseUrl}/device?user_code=ABCD-EFGH`)
    const token = await waitForDeviceLogin(baseUrl, authorization, async (milliseconds) => {
      waits.push(milliseconds)
    })

    expect(token).toBe("session-token")
    expect(waits).toEqual([5_000, 5_000, 10_000])
    expect(seen[0]).toEqual({
      url: `${baseUrl}/api/auth/device/code`,
      body: { client_id: "base-cli" },
    })
    expect(seen[1]?.body).toEqual({
      grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      device_code: "device-1",
      client_id: "base-cli",
    })
  })

  test("拒否されたログインはtokenを返さない", async () => {
    replyWith([{ status: 400, body: { error: "access_denied" } }], [])

    const outcome = await waitForDeviceLogin(
      baseUrl,
      {
        deviceCode: "device-1",
        userCode: "ABCD-EFGH",
        verificationUrl: `${baseUrl}/device`,
        expiresAt: Date.now() + 60_000,
        intervalMilliseconds: 1,
      },
      async () => {},
    ).catch((error: unknown) => error)

    expect(outcome).toBeInstanceOf(ApiError)
  })
})
