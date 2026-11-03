import { expect, test } from "bun:test"
import {
  SYSTEM_AUDIT_ACTION_LABELS,
  SYSTEM_AUDIT_ACTIONS,
} from "@system/domain/catalogs/audit/system-audit-action.catalog"

test("操作の一覧の全項目に日本語の表示名がある", () => {
  const actions = Object.values(SYSTEM_AUDIT_ACTIONS)
  expect(Object.keys(SYSTEM_AUDIT_ACTION_LABELS).sort()).toEqual([...actions].sort())
  for (const action of actions) {
    const label = SYSTEM_AUDIT_ACTION_LABELS[action]
    expect(label).toMatch(/[ぁ-んァ-ヶ一-龯]/)
    expect(label).not.toMatch(/[a-zA-Z]/)
  }
})
