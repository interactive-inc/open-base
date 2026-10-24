import { expect, test } from "bun:test"
import { toLifecycleStatus } from "@/contexts/company/lib/workforce/to-lifecycle-status"

test("Workforceの在籍状態をlifecycleの公開語彙へ変換する", () => {
  expect(toLifecycleStatus("PRE_HIRE")).toBe("prehire")
  expect(toLifecycleStatus("ACTIVE")).toBe("active")
  expect(toLifecycleStatus("ON_LEAVE")).toBe("leave")
  expect(toLifecycleStatus("TERMINATED")).toBe("retired")
})
