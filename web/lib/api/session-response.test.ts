import { afterEach, expect, test, vi } from "vite-plus/test"
import { postLogin } from "@/lib/api/post-login"
import { postBrowserToken } from "@/lib/api/post-browser-token"
import { postIdentityLogin } from "@/lib/api/post-identity-login"
import { postRefreshToken } from "@/lib/api/post-refresh-token"

const mocks = vi.hoisted(() => ({ fetch: vi.fn() }))
vi.mock("@/lib/api/api-fetch", () => ({ apiFetch: mocks.fetch }))
vi.mock("@/lib/auth/get-server-session", () => ({ getServerSession: async () => null }))
afterEach(() => vi.clearAllMocks())
const operations = [
  {
    name: "password",
    run: () => postLogin({ email: "you@example.com", password: "example-password" }),
  },
  { name: "browser", run: () => postBrowserToken({ code: "example-code" }) },
  { name: "identity", run: () => postIdentityLogin({ token: "example-identity" }) },
  { name: "refresh", run: () => postRefreshToken("example-refresh") },
]
const invalidBodies = [
  "not-json",
  "null",
  "[]",
  "{}",
  ...[
    { access_token: "", refresh_token: "example-refresh" },
    { access_token: 0, refresh_token: "example-refresh" },
    { access_token: "example-access" },
    ...["", 0, false, {}, []].map((value) => ({
      access_token: "example-access",
      refresh_token: value,
    })),
  ].map((value) => JSON.stringify(value)),
]
for (const operation of operations) {
  for (const body of invalidBodies) {
    test(`${operation.name}は不正なsession応答 ${body} を失敗として返す`, async () => {
      mocks.fetch.mockResolvedValueOnce(new Response(body, { status: 200 }))
      expect(await operation.run()).toBeInstanceOf(Error)
    })
  }
  for (const refreshToken of [null, "example-rotated"]) {
    test(`${operation.name}は正当なtoken対を保持する (${JSON.stringify(refreshToken)})`, async () => {
      const session = { access_token: "example-access", refresh_token: refreshToken }
      mocks.fetch.mockResolvedValueOnce(
        Response.json({ ...session, account_id: "example-account" }),
      )
      expect(await operation.run()).toEqual(session)
    })
  }
  test(`${operation.name}のHTTP拒否を不正JSONの解釈で置き換えない`, async () => {
    mocks.fetch.mockResolvedValueOnce(new Response("not-json", { status: 401 }))
    expect(await operation.run()).toBeInstanceOf(Error)
  })
}
