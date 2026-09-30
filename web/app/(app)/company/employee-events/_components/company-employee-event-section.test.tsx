import { cleanup, render, screen, within } from "@testing-library/react"
import { afterEach, describe, expect, test, vi } from "vite-plus/test"
import { CompanyEmployeeEventSection } from "@/app/(app)/company/employee-events/_components/company-employee-event-section"

const mocks = vi.hoisted(() => ({ getEmployeeEventList: vi.fn() }))

vi.mock("@/lib/api/get-employee-event-list", () => ({
  getEmployeeEventList: mocks.getEmployeeEventList,
}))
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const joinEvent = {
  id: 1,
  employee_id: "10",
  kind: "join",
  effective_date: "2026-04-01",
  from_department_code: null,
  to_department_code: "D001",
  note: null,
  created_at: "2026-04-01T00:00:00.000Z",
}

describe("CompanyEmployeeEventSection", () => {
  test("種別を日本語にし、欠けた異動元と備考はハイフンにする", async () => {
    mocks.getEmployeeEventList.mockResolvedValue([joinEvent])

    render(await CompanyEmployeeEventSection({ employeeCode: "E001", kind: null }))

    const rows = screen.getAllByRole("row").slice(1)

    expect(within(rows[0]).getByText("入社")).toBeDefined()
    expect(within(rows[0]).getByText("D001")).toBeDefined()
    expect(within(rows[0]).getAllByText("-")).toHaveLength(2)
  })

  test("従業員コードと種別をそのまま api へ渡す", async () => {
    mocks.getEmployeeEventList.mockResolvedValue([joinEvent])

    render(await CompanyEmployeeEventSection({ employeeCode: "E002", kind: "transfer" }))

    expect(mocks.getEmployeeEventList).toHaveBeenCalledWith({
      employeeCode: "E002",
      kind: "transfer",
    })
  })

  test("記録が無いときは対象の従業員コードを添えて空を示す", async () => {
    mocks.getEmployeeEventList.mockResolvedValue([])

    render(await CompanyEmployeeEventSection({ employeeCode: "E003", kind: null }))

    expect(screen.getByText("記録がありません")).toBeDefined()
    expect(screen.getByText("E003 に該当する雇用事実はありません。")).toBeDefined()
    expect(screen.queryByRole("table")).toBeNull()
  })

  test("取得に失敗したときは行を出さない", async () => {
    mocks.getEmployeeEventList.mockResolvedValue(new Error("failed"))

    render(await CompanyEmployeeEventSection({ employeeCode: "E001", kind: null }))

    expect(screen.getByText("雇用事実の取得に失敗しました")).toBeDefined()
    expect(screen.queryByRole("table")).toBeNull()
  })
})
