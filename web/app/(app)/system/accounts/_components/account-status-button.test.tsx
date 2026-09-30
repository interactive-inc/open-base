import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, test, vi } from "vite-plus/test"
import { AccountStatusButton } from "@/app/(app)/system/accounts/_components/account-status-button"
import { setAccountStatusAction } from "@/app/(app)/system/accounts/actions"
import { stepUpAction } from "@/lib/auth/step-up-action"

vi.mock("@/app/(app)/system/accounts/actions", () => ({ setAccountStatusAction: vi.fn() }))
vi.mock("@/lib/auth/step-up-action", () => ({ stepUpAction: vi.fn() }))

async function submitSuspend() {
  render(<AccountStatusButton accountId="acc-1" status="active" />)

  fireEvent.click(screen.getByRole("button", { name: "停止" }))

  await waitFor(() => {
    expect(screen.getByRole("button", { name: "停止する" })).toBeDefined()
  })

  fireEvent.click(screen.getByRole("button", { name: "停止する" }))
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

  vi.mocked(setAccountStatusAction).mockReset()

  vi.mocked(stepUpAction).mockReset()
})

describe("AccountStatusButton の停止", () => {
  test("再認証に成功すると同じ停止をやり直す", async () => {
    vi.mocked(setAccountStatusAction).mockResolvedValue({ kind: "step_up_required" })

    vi.mocked(stepUpAction).mockResolvedValue({ ok: true, error: null })

    await submitSuspend()

    await confirmStepUp()

    await waitFor(() => {
      expect(vi.mocked(setAccountStatusAction).mock.calls.length).toBe(2)
    })

    const retried = vi.mocked(setAccountStatusAction).mock.calls[1]?.[1]

    expect(retried?.get("account_id")).toBe("acc-1")

    expect(retried?.get("status")).toBe("suspended")
  })

  test("再認証ダイアログを開くとき確認ダイアログを閉じる", async () => {
    vi.mocked(setAccountStatusAction).mockResolvedValue({ kind: "step_up_required" })

    await submitSuspend()

    await waitFor(() => {
      expect(screen.getByLabelText("パスワード")).toBeDefined()
    })

    expect(screen.queryByRole("button", { name: "停止する" })).toBe(null)
  })

  test("再認証のあとに拒否されたら確認ダイアログへ理由を戻す", async () => {
    vi.mocked(setAccountStatusAction)
      .mockResolvedValueOnce({ kind: "step_up_required" })
      .mockResolvedValue({ kind: "failed", error: "最後の管理者は停止できません" })

    vi.mocked(stepUpAction).mockResolvedValue({ ok: true, error: null })

    await submitSuspend()

    await confirmStepUp()

    await waitFor(() => {
      expect(screen.getByText("最後の管理者は停止できません")).toBeDefined()
    })
  })

  test("拒否された理由を確認ダイアログに表示する", async () => {
    vi.mocked(setAccountStatusAction).mockResolvedValue({
      kind: "failed",
      error: "自分自身は停止できません",
    })

    await submitSuspend()

    await waitFor(() => {
      expect(screen.getByText("自分自身は停止できません")).toBeDefined()
    })
  })
})

describe("AccountStatusButton の有効化", () => {
  test("再認証に成功すると同じ有効化をやり直す", async () => {
    vi.mocked(setAccountStatusAction).mockResolvedValue({ kind: "step_up_required" })

    vi.mocked(stepUpAction).mockResolvedValue({ ok: true, error: null })

    render(<AccountStatusButton accountId="acc-1" status="suspended" />)

    fireEvent.click(screen.getByRole("button", { name: "有効化" }))

    await confirmStepUp()

    await waitFor(() => {
      expect(vi.mocked(setAccountStatusAction).mock.calls.length).toBe(2)
    })

    expect(vi.mocked(setAccountStatusAction).mock.calls[1]?.[1].get("status")).toBe("active")
  })
})
