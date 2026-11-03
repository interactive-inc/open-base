import { expect, test } from "bun:test"
import { toEmployeeSearchKey } from "@/contexts/company/infrastructure/adapters/employee/lib/to-employee-search-key"

test("空白・全角半角・ひらがなとカタカナ・英字の大小をそろえる", () => {
  expect(toEmployeeSearchKey("山田　太郎")).toBe(toEmployeeSearchKey("山田太郎"))
  expect(toEmployeeSearchKey("ﾔﾏﾀﾞ ﾀﾛｳ")).toBe(toEmployeeSearchKey("やまだたろう"))
  expect(toEmployeeSearchKey("ＥＭＰ－００１")).toBe(toEmployeeSearchKey("emp-001"))
})
