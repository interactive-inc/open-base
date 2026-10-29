import { NextResponse } from "next/server"
import { afterEach, expect, test, vi } from "vite-plus/test"
import { loginAction } from "@/lib/auth/login-action"

const mocks = vi.hoisted(() => ({ cookies: vi.fn(), postLogin: vi.fn() }))
vi.mock("next/headers", () => ({ cookies: mocks.cookies }))
vi.mock("@/lib/api/post-login", () => ({ postLogin: mocks.postLogin }))
vi.mock("@/lib/i18n/get-translator", () => ({
  getTranslator: async () => (message: string) => message,
}))
afterEach(() => vi.clearAllMocks())

for (const refreshToken of [null, "example-new-refresh"]) {
  test(`ログインの認証cookieを一組として置換する (refresh=${refreshToken})`, async () => {
    const response = new NextResponse()
    response.cookies.set("session", "example-old-access")
    response.cookies.set("refresh_token", "example-old-refresh")
    mocks.cookies.mockResolvedValue(response.cookies)
    mocks.postLogin.mockResolvedValue({
      access_token: "example-new-access",
      refresh_token: refreshToken,
    })
    const input = new FormData()
    input.set("email", "you@example.com")
    input.set("password", "example-password")
    expect(await loginAction({ ok: false, error: null }, input)).toEqual({ ok: true, error: null })
    expect(response.cookies.get("session")?.value).toBe("example-new-access")
    expect(response.cookies.get("refresh_token")).toMatchObject({
      value: refreshToken ?? "",
      maxAge: refreshToken === null ? 0 : 7 * 24 * 60 * 60,
    })
  })
}

test("ログイン拒否では既存の認証cookieを変更しない", async () => {
  const response = new NextResponse()
  response.cookies.set("session", "example-old-access")
  response.cookies.set("refresh_token", "example-old-refresh")
  const before = response.headers.getSetCookie()
  mocks.cookies.mockResolvedValue(response.cookies)
  mocks.postLogin.mockResolvedValue(new Error("rejected"))
  const input = new FormData()
  input.set("email", "you@example.com")
  input.set("password", "example-password")
  expect((await loginAction({ ok: false, error: null }, input)).ok).toBe(false)
  expect(response.headers.getSetCookie()).toEqual(before)
})
