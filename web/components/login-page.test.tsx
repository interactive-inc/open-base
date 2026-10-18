import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, test, vi } from "vite-plus/test"
import { LoginPage } from "@/components/login-page"

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock("@/lib/i18n/use-translator", () => ({ useTranslator: () => (value: string) => value }))
vi.mock("@/components/login-form", () => ({ LoginForm: () => <form /> }))

const originalAppName = process.env.NEXT_PUBLIC_APP_NAME

afterEach(() => {
  cleanup()
  process.env.NEXT_PUBLIC_APP_NAME = originalAppName
  vi.unstubAllEnvs()
})

describe("LoginPage", () => {
  test("設定されたアプリ名をログイン見出しに表示する", () => {
    process.env.NEXT_PUBLIC_APP_NAME = "Open Base"

    render(<LoginPage />)

    expect(screen.getByText("Open Base にログイン")).toBeDefined()
  })
})

test("空の外部認証設定ではログインリンクを表示しない", () => {
  vi.stubEnv("NEXT_PUBLIC_IDENTITY_LOGIN_URL", "")
  vi.stubEnv("NEXT_PUBLIC_APP_NAME", "")
  render(<LoginPage />)
  expect(screen.queryByRole("link")).toBeNull()
  expect(screen.getByText("Open Base にログイン")).toBeDefined()
})

test("デモ用アカウントが両方設定されたときだけ入力済みの案内を出す", async () => {
  const loginForm = await import("@/components/login-form")
  const spy = vi.spyOn(loginForm, "LoginForm")
  vi.stubEnv("NEXT_PUBLIC_DEMO_LOGIN_EMAIL", "demo@example.com")
  vi.stubEnv("NEXT_PUBLIC_DEMO_LOGIN_PASSWORD", "demo-password-example")
  render(<LoginPage />)
  expect(
    screen.getByText("デモ用のアカウントを入力済みです。そのままログインして閲覧できます。"),
  ).toBeDefined()
  expect(spy.mock.calls[0]?.[0]).toMatchObject({
    defaultEmail: "demo@example.com",
    defaultPassword: "demo-password-example",
  })
  cleanup()
  spy.mockClear()
  vi.stubEnv("NEXT_PUBLIC_DEMO_LOGIN_PASSWORD", "")
  render(<LoginPage />)
  expect(
    screen.getByText("アカウントのメールアドレスとパスワードを入力してください。"),
  ).toBeDefined()
  expect(spy.mock.calls[0]?.[0]).toMatchObject({ defaultEmail: undefined })
})
