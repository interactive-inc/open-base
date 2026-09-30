import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, test, vi } from "vite-plus/test"
import { ResetPasswordButton } from "@/app/(app)/system/accounts/_components/reset-password-button"
import { resetPasswordAction } from "@/app/(app)/system/accounts/actions"
import { stepUpAction } from "@/lib/auth/step-up-action"

vi.mock("@/app/(app)/system/accounts/actions", () => ({ resetPasswordAction: vi.fn() }))
vi.mock("@/lib/auth/step-up-action", () => ({ stepUpAction: vi.fn() }))

async function submitNewPassword() {
  render(<ResetPasswordButton accountId="acc-1" />)

  fireEvent.click(screen.getByRole("button", { name: "PW再設定" }))

  await waitFor(() => {
    expect(screen.getByLabelText("新しいパスワード")).toBeDefined()
  })

  fireEvent.change(screen.getByLabelText("新しいパスワード"), {
    target: { value: "new-password-1234" },
  })

  fireEvent.click(screen.getByRole("button", { name: "再設定する" }))
}

async function confirmStepUp() {
  await waitFor(() => {
    expect(screen.getByLabelText("パスワード")).toBeDefined()
  })

  fireEvent.change(screen.getByLabelText("パスワード"), { target: { value: "password" } })

  fireEvent.click(screen.getByRole("button", { name: "確認して続行" }))
}

afterEach(() => {
  cleanup()

  vi.mocked(resetPasswordAction).mockReset()

  vi.mocked(stepUpAction).mockReset()
})

describe("ResetPasswordButton", () => {
  test("再認証に成功すると同じパスワードで再設定をやり直す", async () => {
    vi.mocked(resetPasswordAction).mockResolvedValue({ kind: "step_up_required" })

    vi.mocked(stepUpAction).mockResolvedValue({ ok: true, error: null })

    await submitNewPassword()

    await confirmStepUp()

    await waitFor(() => {
      expect(vi.mocked(resetPasswordAction).mock.calls.length).toBe(2)
    })

    const retried = vi.mocked(resetPasswordAction).mock.calls[1]?.[1]

    expect(retried?.get("account_id")).toBe("acc-1")

    expect(retried?.get("new_password")).toBe("new-password-1234")
  })

  test("再認証ダイアログを開くとき入力ダイアログを閉じる", async () => {
    vi.mocked(resetPasswordAction).mockResolvedValue({ kind: "step_up_required" })

    await submitNewPassword()

    await waitFor(() => {
      expect(screen.getByLabelText("パスワード")).toBeDefined()
    })

    expect(screen.queryByLabelText("新しいパスワード")).toBe(null)
  })

  test("再認証のあとに拒否されたら入力ダイアログへ理由を戻す", async () => {
    vi.mocked(resetPasswordAction)
      .mockResolvedValueOnce({ kind: "step_up_required" })
      .mockResolvedValue({
        kind: "failed",
        error: "自分より強い権限のアカウントは変更できません",
      })

    vi.mocked(stepUpAction).mockResolvedValue({ ok: true, error: null })

    await submitNewPassword()

    await confirmStepUp()

    await waitFor(() => {
      expect(screen.getByText("自分より強い権限のアカウントは変更できません")).toBeDefined()
    })
  })

  test("拒否された理由を入力ダイアログに表示する", async () => {
    vi.mocked(resetPasswordAction).mockResolvedValue({
      kind: "failed",
      error: "このアカウントにはパスワードが設定されていません",
    })

    await submitNewPassword()

    await waitFor(() => {
      expect(screen.getByText("このアカウントにはパスワードが設定されていません")).toBeDefined()
    })
  })
})
