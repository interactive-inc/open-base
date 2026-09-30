import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, test, vi } from "vite-plus/test"
import { GrantRoleForm } from "@/app/(app)/system/accounts/_components/grant-role-form"
import { grantAccountRoleAction } from "@/app/(app)/system/accounts/actions"
import { stepUpAction } from "@/lib/auth/step-up-action"

vi.mock("@/app/(app)/system/accounts/actions", () => ({ grantAccountRoleAction: vi.fn() }))
vi.mock("@/lib/auth/step-up-action", () => ({ stepUpAction: vi.fn() }))

afterEach(() => {
  cleanup()

  vi.mocked(grantAccountRoleAction).mockReset()

  vi.mocked(stepUpAction).mockReset()
})

describe("GrantRoleForm", () => {
  test("再認証に成功すると同じロールで付与をやり直す", async () => {
    vi.mocked(grantAccountRoleAction).mockResolvedValue({ kind: "step_up_required" })

    vi.mocked(stepUpAction).mockResolvedValue({ ok: true, error: null })

    render(<GrantRoleForm accountId="acc-1" roles={[{ id: "role-1", key: "accounting" }]} />)

    fireEvent.change(screen.getByLabelText("付与するロール"), { target: { value: "role-1" } })

    fireEvent.click(screen.getByRole("button", { name: "付与" }))

    await waitFor(() => {
      expect(screen.getByLabelText("パスワード")).toBeDefined()
    })

    fireEvent.change(screen.getByLabelText("パスワード"), { target: { value: "password" } })

    fireEvent.click(screen.getByRole("button", { name: "確認して続行" }))

    await waitFor(() => {
      expect(vi.mocked(grantAccountRoleAction).mock.calls.length).toBe(2)
    })

    const retried = vi.mocked(grantAccountRoleAction).mock.calls[1]?.[1]

    expect(retried?.get("account_id")).toBe("acc-1")

    expect(retried?.get("role_id")).toBe("role-1")
  })

  test("再認証をやめると付与をやり直さない", async () => {
    vi.mocked(grantAccountRoleAction).mockResolvedValue({ kind: "step_up_required" })

    render(<GrantRoleForm accountId="acc-1" roles={[{ id: "role-1", key: "accounting" }]} />)

    fireEvent.change(screen.getByLabelText("付与するロール"), { target: { value: "role-1" } })

    fireEvent.click(screen.getByRole("button", { name: "付与" }))

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "やめる" })).toBeDefined()
    })

    fireEvent.click(screen.getByRole("button", { name: "やめる" }))

    await waitFor(() => {
      expect(screen.queryByLabelText("パスワード")).toBe(null)
    })

    expect(vi.mocked(grantAccountRoleAction).mock.calls.length).toBe(1)
  })
})
