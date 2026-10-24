import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, test, vi } from "vite-plus/test"
import { StepUpDialog } from "@/components/step-up-dialog"
import { stepUpAction } from "@/lib/auth/step-up-action"

vi.mock("@/lib/auth/step-up-action", () => ({ stepUpAction: vi.fn() }))

afterEach(() => {
  cleanup()

  vi.unstubAllEnvs()

  vi.mocked(stepUpAction).mockReset()
})

describe("StepUpDialog", () => {
  test("パスワードが違うときダイアログ内に理由を出す", async () => {
    vi.mocked(stepUpAction).mockResolvedValue({ ok: false, error: "パスワードが違います" })

    const onSucceeded = vi.fn()

    render(<StepUpDialog open={true} onSucceeded={onSucceeded} onCancel={vi.fn()} />)

    fireEvent.change(screen.getByLabelText("パスワード"), { target: { value: "wrong" } })

    fireEvent.click(screen.getByRole("button", { name: "確認して続行" }))

    await waitFor(() => {
      expect(screen.getByText("パスワードが違います")).toBeDefined()
    })

    expect(onSucceeded.mock.calls.length).toBe(0)
  })

  test("再認証に成功したら呼び出し元へ知らせる", async () => {
    vi.mocked(stepUpAction).mockResolvedValue({ ok: true, error: null })

    const onSucceeded = vi.fn()

    render(<StepUpDialog open={true} onSucceeded={onSucceeded} onCancel={vi.fn()} />)

    fireEvent.change(screen.getByLabelText("パスワード"), { target: { value: "password" } })

    fireEvent.click(screen.getByRole("button", { name: "確認して続行" }))

    await waitFor(() => {
      expect(onSucceeded.mock.calls.length).toBe(1)
    })
  })

  test("外部 identity provider を設定した環境では同じ画面へ戻る再認証の経路を出す", () => {
    vi.stubEnv("NEXT_PUBLIC_IDENTITY_LOGIN_URL", "https://login.example.com")

    render(<StepUpDialog open={true} onSucceeded={vi.fn()} onCancel={vi.fn()} />)

    window.history.pushState({}, "", "/system/roles?page=2")
    const link = screen.getByText("組織のアカウントで再認証する").closest("a")
    link?.addEventListener("click", (event) => event.preventDefault())
    if (link !== null) fireEvent.click(link)
    expect(link?.getAttribute("href")).toBe(
      "/auth/broker/login?purpose=step-up&return_to=%2Fsystem%2Froles%3Fpage%3D2",
    )
    expect(screen.getByLabelText("パスワード")).toBeDefined()
  })

  test("パスワードログインを隠した環境ではパスワード欄を出さない", () => {
    vi.stubEnv("NEXT_PUBLIC_IDENTITY_LOGIN_URL", "https://login.example.com")
    vi.stubEnv("NEXT_PUBLIC_PASSWORD_LOGIN_HIDDEN", "1")

    render(<StepUpDialog open={true} onSucceeded={vi.fn()} onCancel={vi.fn()} />)

    expect(screen.queryByLabelText("パスワード")).toBeNull()
  })

  test("外部 identity provider が無い環境では再認証の経路を出さない", () => {
    render(<StepUpDialog open={true} onSucceeded={vi.fn()} onCancel={vi.fn()} />)

    expect(screen.queryByText("組織のアカウントで再認証する")).toBeNull()
  })
})
