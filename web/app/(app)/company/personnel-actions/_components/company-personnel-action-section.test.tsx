import { cleanup, render, screen, within } from "@testing-library/react"
import { afterEach, describe, expect, test, vi } from "vite-plus/test"
import { CompanyPersonnelActionSection } from "@/app/(app)/company/personnel-actions/_components/company-personnel-action-section"

const mocks = vi.hoisted(() => ({ getCompanyPersonnelActions: vi.fn() }))
vi.mock("@/lib/api/get-company-personnel-actions", () => ({
  getCompanyPersonnelActions: mocks.getCompanyPersonnelActions,
}))
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})
const action = {
  id: "action:correction",
  employee_id: "employee:1",
  kind: "corrected",
  event_on: "2030-06-01",
  recorded_at: "2030-06-02T00:00:00.000Z",
  current_employee: { name: "Example Employee", code: "E001" },
  source_type: "direct",
  source_application_id: null,
  recorded_by_account_id: "account:1",
  requested_by_employee_id: null,
  corrects_action_id: "action:original",
  corrected_by_action_id: null,
  summary: {
    kind: "corrected",
    eventOn: "2030-06-01",
    correctsActionId: "action:original",
    replacementKind: "retired",
    replacementEventOn: "2030-07-31",
  },
}

describe("CompanyPersonnelActionSection", () => {
  test("実際の発令対象、来歴、訂正後の発効日を表示し、検索条件を保ってページングする", async () => {
    mocks.getCompanyPersonnelActions.mockResolvedValue({ data: [action], next_cursor: "cursor+/=" })
    const query = { employee_id: "employee:1", from: "2030-01-01", cursor: "previous", limit: 10 }
    render(await CompanyPersonnelActionSection({ query }))
    expect(mocks.getCompanyPersonnelActions).toHaveBeenCalledWith(query)
    const row = screen.getAllByRole("row")[1]
    expect(within(row).getByText("Example Employee")).toBeDefined()
    expect(within(row).getByText("2030-06-01")).toBeDefined()
    expect(within(row).getByText("2030-06-02T00:00:00.000Z")).toBeDefined()
    expect(within(row).getByText("訂正後: 退職 / 2030-07-31")).toBeDefined()
    expect(within(row).getByText("直接発令")).toBeDefined()
    expect(screen.getByRole("link", { name: "訂正元の発令" }).getAttribute("href")).toBe(
      "/company/personnel-actions?id=action%3Aoriginal",
    )
    const next = new URL(
      screen.getByRole("link", { name: "以前の記録を表示" }).getAttribute("href") ?? "",
      "https://example.com",
    )
    expect(Object.fromEntries(next.searchParams)).toEqual({
      employee_id: "employee:1",
      from: "2030-01-01",
      cursor: "cursor+/=",
      limit: "10",
    })
    expect(
      screen.getByRole("link", { name: "この条件の最新の履歴" }).getAttribute("href"),
    ).not.toContain("cursor")
  })
  test("現在の従業員名がない記録もIDで表示し、訂正先をたどれる", async () => {
    mocks.getCompanyPersonnelActions.mockResolvedValue({
      data: [
        {
          ...action,
          kind: "retired",
          current_employee: null,
          corrects_action_id: null,
          corrected_by_action_id: "action:later",
          summary: { kind: "retired", eventOn: "2030-06-01", status: "retired" },
        },
      ],
      next_cursor: null,
    })
    render(await CompanyPersonnelActionSection())
    expect(screen.getByRole("link", { name: "employee:1" })).toBeDefined()
    expect(screen.getByRole("link", { name: "訂正後の記録" }).getAttribute("href")).toBe(
      "/company/personnel-actions?id=action%3Alater",
    )
    expect(screen.queryByRole("link", { name: "以前の記録を表示" })).toBeNull()
  })
  test("空のときは登録がないことを示す", async () => {
    mocks.getCompanyPersonnelActions.mockResolvedValue({ data: [], next_cursor: null })
    render(await CompanyPersonnelActionSection())
    expect(screen.getByText("該当する人事発令はありません")).toBeDefined()
    expect(screen.queryByRole("table")).toBeNull()
  })
  test("取得に失敗したときは行を出さない", async () => {
    mocks.getCompanyPersonnelActions.mockResolvedValue(new Error("failed"))
    render(await CompanyPersonnelActionSection())
    expect(screen.getByText("人事発令の取得に失敗しました")).toBeDefined()
    expect(screen.queryByRole("table")).toBeNull()
  })
})
