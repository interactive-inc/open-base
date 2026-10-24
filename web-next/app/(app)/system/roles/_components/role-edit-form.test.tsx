import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, test, vi } from "vite-plus/test"
import { RoleEditForm } from "@/app/(app)/system/roles/_components/role-edit-form"
import { updateRoleAction } from "@/app/(app)/system/roles/actions"
import { stepUpAction } from "@/lib/auth/step-up-action"

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock("@/app/(app)/system/roles/actions", () => ({ updateRoleAction: vi.fn() }))
vi.mock("@/lib/auth/step-up-action", () => ({ stepUpAction: vi.fn() }))

const permissions = [
  { key: "employee:read", description: "従業員を閲覧する", category: "employee" },
  { key: "expense:approve", description: "経費申請を承認・却下する", category: "expense" },
]

function toSubmittedPermissionKeys(container: HTMLElement): ReadonlyArray<string> {
  const inputs = container.querySelectorAll<HTMLInputElement>('input[name="permission_keys"]')

  return [...inputs]
    .filter((input) => input.type === "hidden" || input.checked)
    .map((input) => input.value)
}

function renderForm(grantedPermissionKeys: ReadonlyArray<string>) {
  return render(
    <RoleEditForm
      roleId="1"
      name="経理"
      description={null}
      grantedPermissionKeys={grantedPermissionKeys}
      permissions={permissions}
    />,
  )
}

afterEach(() => {
  cleanup()

  vi.mocked(updateRoleAction).mockReset()

  vi.mocked(stepUpAction).mockReset()
})

describe("RoleEditForm", () => {
  test("付与済みの権限にcheckboxを入れる", () => {
    const { container } = renderForm(["expense:approve"])

    expect(toSubmittedPermissionKeys(container)).toEqual(["expense:approve"])
  })

  test("画面に出ない付与済み権限をhiddenで持ち越す", () => {
    // 無効なAppの権限や操作者が持たない権限はcheckboxが無い。
    // 送信対象から落ちると保存のたびに黙って剥がれるため hidden で残す。
    const { container } = renderForm(["expense:approve", "goal:read:all", "thanks_reward:manage"])

    expect(toSubmittedPermissionKeys(container).toSorted()).toEqual([
      "expense:approve",
      "goal:read:all",
      "thanks_reward:manage",
    ])
  })

  test("外した権限はhiddenで復活させない", () => {
    const { container } = renderForm([])

    expect(toSubmittedPermissionKeys(container)).toEqual([])
  })

  test("再認証を求められたら再認証ダイアログを開く", async () => {
    vi.mocked(updateRoleAction).mockResolvedValue({ kind: "step_up_required" })

    renderForm([])

    fireEvent.click(screen.getByRole("button", { name: "変更を保存" }))

    await waitFor(() => {
      expect(screen.getByText("パスワードを再入力してください")).toBeDefined()
    })
  })

  test("再認証に成功すると同じ保存をやり直す", async () => {
    vi.mocked(updateRoleAction).mockResolvedValue({ kind: "step_up_required" })

    vi.mocked(stepUpAction).mockResolvedValue({ ok: true, error: null })

    renderForm([])

    fireEvent.click(screen.getByRole("button", { name: "変更を保存" }))

    await waitFor(() => {
      expect(screen.getByLabelText("パスワード")).toBeDefined()
    })

    fireEvent.change(screen.getByLabelText("パスワード"), { target: { value: "password" } })

    fireEvent.click(screen.getByRole("button", { name: "確認して続行" }))

    await waitFor(() => {
      expect(vi.mocked(updateRoleAction).mock.calls.length).toBe(2)
    })
  })

  test("拒否された理由をフォームに表示し続ける", async () => {
    vi.mocked(updateRoleAction).mockResolvedValue({
      kind: "failed",
      error: "システム定義のロールは変更・削除できません",
    })

    renderForm([])

    fireEvent.click(screen.getByRole("button", { name: "変更を保存" }))

    await waitFor(() => {
      expect(screen.getByText("システム定義のロールは変更・削除できません")).toBeDefined()
    })
  })

  test("拒否されても編集した内容を初期値へ戻さない", async () => {
    vi.mocked(updateRoleAction).mockResolvedValue({
      kind: "failed",
      error: "システム定義のロールは変更・削除できません",
    })

    renderForm([])

    fireEvent.change(screen.getByLabelText("名前"), { target: { value: "経理 2" } })

    fireEvent.click(screen.getByRole("button", { name: "変更を保存" }))

    await waitFor(() => {
      expect(vi.mocked(updateRoleAction).mock.calls.length).toBe(1)
    })

    await waitFor(() => {
      expect(screen.getByText("システム定義のロールは変更・削除できません")).toBeDefined()
    })

    expect(screen.getByLabelText<HTMLInputElement>("名前").value).toBe("経理 2")
  })

  test("再認証を求められても編集した内容を保つ", async () => {
    vi.mocked(updateRoleAction).mockResolvedValue({ kind: "step_up_required" })

    renderForm([])

    fireEvent.change(screen.getByLabelText("名前"), { target: { value: "経理 2" } })

    fireEvent.click(screen.getByRole("button", { name: "変更を保存" }))

    await waitFor(() => {
      expect(screen.getByLabelText("パスワード")).toBeDefined()
    })

    expect(screen.getByLabelText<HTMLInputElement>("名前").value).toBe("経理 2")
  })
})
