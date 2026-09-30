import { afterEach, describe, expect, test, vi } from "vite-plus/test"
import { loginAction } from "@/lib/auth/login-action"

const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  postLogin: vi.fn(),
  setSessionCookies: vi.fn(),
}))

vi.mock("next/headers", () => ({ cookies: mocks.cookies }))
vi.mock("@/lib/api/post-login", () => ({ postLogin: mocks.postLogin }))
vi.mock("@/lib/auth/set-session-cookies", () => ({
  setSessionCookies: mocks.setSessionCookies,
}))
vi.mock("@/lib/i18n/get-translator", () => ({
  getTranslator: async () => (message: string) => message,
}))

afterEach(() => vi.clearAllMocks())

describe("loginAction", () => {
  test("sets the session and returns success without redirecting away from the current URL", async () => {
    const cookieStore = { set: vi.fn() }
    mocks.cookies.mockResolvedValue(cookieStore)
    mocks.postLogin.mockResolvedValue({
      access_token: "access-token",
      refresh_token: "refresh-token",
    })
    const formData = new FormData()
    formData.set("email", "you@example.com")
    formData.set("password", "password")

    const result = await loginAction({ ok: false, error: null }, formData)

    expect(result).toEqual({ ok: true, error: null })
    expect(mocks.setSessionCookies).toHaveBeenCalledWith({
      cookieStore,
      accessToken: "access-token",
      refreshToken: "refresh-token",
    })
  })

  test("returns a validation message when credentials are missing", async () => {
    const result = await loginAction({ ok: false, error: null }, new FormData())

    expect(result).toEqual({
      ok: false,
      error: "メールアドレスとパスワードを入力してください",
    })
    expect(mocks.postLogin).not.toHaveBeenCalled()
  })
})
