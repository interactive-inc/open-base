import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, test, vi } from "vite-plus/test"
import { RevokeRoleButton } from "@/app/(app)/system/accounts/_components/revoke-role-button"
import { revokeAccountRoleAction } from "@/app/(app)/system/accounts/actions"
import { stepUpAction } from "@/lib/auth/step-up-action"

vi.mock("@/app/(app)/system/accounts/actions", () => ({ revokeAccountRoleAction: vi.fn() }))
vi.mock("@/lib/auth/step-up-action", () => ({ stepUpAction: vi.fn() }))

afterEach(() => {
  cleanup()

  vi.mocked(revokeAccountRoleAction).mockReset()

  vi.mocked(stepUpAction).mockReset()
})

describe("RevokeRoleButton", () => {
  test("再認証に成功すると同じ剥奪をやり直す", async () => {
    vi.mocked(revokeAccountRoleAction).mockResolvedValue({ kind: "step_up_required" })

    vi.mocked(stepUpAction).mockResolvedValue({ ok: true, error: null })

    render(<RevokeRoleButton accountId="acc-1" bindingId="binding-1" roleLabel="accounting" />)

    fireEvent.click(screen.getByRole("button", { name: "accounting を剥奪" }))

    await waitFor(() => {
      expect(screen.getByLabelText("パスワード")).toBeDefined()
    })

    fireEvent.change(screen.getByLabelText("パスワード"), { target: { value: "password" } })

    fireEvent.click(screen.getByRole("button", { name: "確認して続行" }))

    await waitFor(() => {
      expect(vi.mocked(revokeAccountRoleAction).mock.calls.length).toBe(2)
    })

    const retried = vi.mocked(revokeAccountRoleAction).mock.calls[1]?.[1]

    expect(retried?.get("account_id")).toBe("acc-1")

    expect(retried?.get("binding_id")).toBe("binding-1")
  })

  test("拒否されたら再認証ダイアログを開かない", async () => {
    vi.mocked(revokeAccountRoleAction).mockResolvedValue({
      kind: "failed",
      error: "最後の管理者はロールを外せません",
    })

    render(<RevokeRoleButton accountId="acc-1" bindingId="binding-1" roleLabel="accounting" />)

    fireEvent.click(screen.getByRole("button", { name: "accounting を剥奪" }))

    await waitFor(() => {
      expect(vi.mocked(revokeAccountRoleAction).mock.calls.length).toBe(1)
    })

    expect(screen.queryByLabelText("パスワード")).toBe(null)
  })
})
