import { describe, expect, test } from "vite-plus/test"
import { toRoleActionErrorMessage } from "@/app/(app)/system/roles/_lib/to-role-action-error-message"

describe("toRoleActionErrorMessage", () => {
  test("権限不足を伝える", () => {
    expect(toRoleActionErrorMessage("forbidden")).toBe("ロールを操作する権限がありません")
  })

  test("システム定義ロールの変更不可を伝える", () => {
    expect(toRoleActionErrorMessage("managed_role")).toBe(
      "システム定義のロールは変更・削除できません",
    )
  })

  test("キー重複を伝える", () => {
    expect(toRoleActionErrorMessage("role_conflict")).toBe("同じキーのロールが既に存在します")
  })

  test("割当中の削除不可を伝える", () => {
    expect(toRoleActionErrorMessage("role_in_use")).toBe("割当中のロールは削除できません")
  })

  test("ロール不在を伝える", () => {
    expect(toRoleActionErrorMessage("role_not_found")).toBe("ロールが見つかりません")
  })

  test("未知のcodeは共通文言にする", () => {
    expect(toRoleActionErrorMessage("something_else")).toBe(
      "保存に失敗しました。時間をおいて再度お試しください",
    )
  })

  test("codeが無い応答も共通文言にする", () => {
    expect(toRoleActionErrorMessage(null)).toBe(
      "保存に失敗しました。時間をおいて再度お試しください",
    )
  })
})
