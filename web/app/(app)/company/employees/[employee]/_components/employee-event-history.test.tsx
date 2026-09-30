import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, expect, test, vi } from "vite-plus/test"
import { EmployeeEventHistory } from "@/app/(app)/company/employees/[employee]/_components/employee-event-history"

const mocks = vi.hoisted(() => ({ getEmployeeEventList: vi.fn() }))
vi.mock("@/lib/api/get-employee-event-list", () => ({
  getEmployeeEventList: mocks.getEmployeeEventList,
}))
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

test("旧注記の期間と原文を残し、確定した発令と区別する", async () => {
  mocks.getEmployeeEventList.mockResolvedValue([
    {
      id: 1,
      employee_id: "employee:test",
      kind: "retire",
      effective_date: "2020-04-01",
      from_department_code: "OLD",
      to_department_code: null,
      note: "当時の記録",
      created_at: "2021-01-01T00:00:00Z",
    },
  ])
  render(await EmployeeEventHistory({ code: "E001" }))
  expect(screen.getByText("旧異動・在籍記録")).toBeTruthy()
  expect(screen.getByText("2020-04-01")).toBeTruthy()
  expect(screen.getByText("当時の記録")).toBeTruthy()
  expect(mocks.getEmployeeEventList).toHaveBeenCalledWith({ employeeCode: "E001", kind: null })
})

test("取得失敗を記録なしへ置き換えない", async () => {
  mocks.getEmployeeEventList.mockResolvedValue(new Error("unavailable"))
  render(await EmployeeEventHistory({ code: "E001" }))
  expect(screen.getByText("旧異動・在籍記録を取得できませんでした")).toBeTruthy()
  expect(screen.queryByText("異動・在籍イベントの記録はありません。")).toBeNull()
})

test("取得に成功した空集合だけを記録なしとして表示する", async () => {
  mocks.getEmployeeEventList.mockResolvedValue([])
  render(await EmployeeEventHistory({ code: "E001" }))
  expect(screen.getByText("異動・在籍イベントの記録はありません。")).toBeTruthy()
})
