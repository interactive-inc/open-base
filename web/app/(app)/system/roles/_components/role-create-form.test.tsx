import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, test, vi } from "vite-plus/test"
import { RoleCreateForm } from "@/app/(app)/system/roles/_components/role-create-form"
import { createRoleAction } from "@/app/(app)/system/roles/actions"
import { stepUpAction } from "@/lib/auth/step-up-action"

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock("@/app/(app)/system/roles/actions", () => ({ createRoleAction: vi.fn() }))
vi.mock("@/lib/auth/step-up-action", () => ({ stepUpAction: vi.fn() }))

const permissions = [
  { key: "employee:read", description: "従業員を閲覧する", category: "employee" },
]

function renderFilledForm() {
  render(<RoleCreateForm permissions={permissions} />)

  fireEvent.change(screen.getByLabelText("キー（名前空間:名前、不変）"), {
    target: { value: "company:auditor" },
  })

  fireEvent.change(screen.getByLabelText("名前"), { target: { value: "監査担当" } })
}

afterEach(() => {
  cleanup()

  vi.mocked(createRoleAction).mockReset()

  vi.mocked(stepUpAction).mockReset()
})

describe("RoleCreateForm", () => {
  test("再認証を求められても入力した内容を保つ", async () => {
    vi.mocked(createRoleAction).mockResolvedValue({ kind: "step_up_required" })

    renderFilledForm()

    fireEvent.click(screen.getByRole("button", { name: "ロールを作成" }))

    // 入力が空のまま submit が止まると見かけ上テストが通るため、実行を先に確かめる。
    await waitFor(() => {
      expect(vi.mocked(createRoleAction).mock.calls.length).toBe(1)
    })

    await waitFor(() => {
      expect(screen.getByLabelText("パスワード")).toBeDefined()
    })

    expect(screen.getByLabelText<HTMLInputElement>("キー（名前空間:名前、不変）").value).toBe(
      "company:auditor",
    )

    expect(screen.getByLabelText<HTMLInputElement>("名前").value).toBe("監査担当")
  })

  test("拒否されても入力した内容を保つ", async () => {
    vi.mocked(createRoleAction).mockResolvedValue({
      kind: "failed",
      error: "同じキーのロールが既に存在します",
    })

    renderFilledForm()

    fireEvent.click(screen.getByRole("button", { name: "ロールを作成" }))

    await waitFor(() => {
      expect(vi.mocked(createRoleAction).mock.calls.length).toBe(1)
    })

    await waitFor(() => {
      expect(screen.getByText("同じキーのロールが既に存在します")).toBeDefined()
    })

    expect(screen.getByLabelText<HTMLInputElement>("キー（名前空間:名前、不変）").value).toBe(
      "company:auditor",
    )
  })

  test("再認証に成功すると同じ作成をやり直す", async () => {
    vi.mocked(createRoleAction).mockResolvedValue({ kind: "step_up_required" })

    vi.mocked(stepUpAction).mockResolvedValue({ ok: true, error: null })

    renderFilledForm()

    fireEvent.click(screen.getByRole("button", { name: "ロールを作成" }))

    await waitFor(() => {
      expect(screen.getByLabelText("パスワード")).toBeDefined()
    })

    fireEvent.change(screen.getByLabelText("パスワード"), { target: { value: "password" } })

    fireEvent.click(screen.getByRole("button", { name: "確認して続行" }))

    await waitFor(() => {
      expect(vi.mocked(createRoleAction).mock.calls.length).toBe(2)
    })

    // 再送でも入力した値が API へ渡ることを確かめる。
    const replayed = vi.mocked(createRoleAction).mock.calls[1]?.[1]

    expect(replayed?.get("key")).toBe("company:auditor")
  })

  test("ダイアログの送信を外側のフォームへ渡さない", async () => {
    // 再認証ダイアログを form の内側で描画すると、ダイアログの submit が外側まで
    // 伝播し、外側の preventDefault によって grant の発行が実行されなくなる。
    vi.mocked(createRoleAction).mockResolvedValue({ kind: "step_up_required" })

    vi.mocked(stepUpAction).mockResolvedValue({ ok: false, error: "パスワードが違います" })

    renderFilledForm()

    fireEvent.click(screen.getByRole("button", { name: "ロールを作成" }))

    await waitFor(() => {
      expect(screen.getByLabelText("パスワード")).toBeDefined()
    })

    fireEvent.change(screen.getByLabelText("パスワード"), { target: { value: "wrong" } })

    fireEvent.click(screen.getByRole("button", { name: "確認して続行" }))

    await waitFor(() => {
      expect(vi.mocked(stepUpAction).mock.calls.length).toBe(1)
    })

    await waitFor(() => {
      expect(screen.getByText("パスワードが違います")).toBeDefined()
    })

    expect(vi.mocked(createRoleAction).mock.calls.length).toBe(1)
  })
})
