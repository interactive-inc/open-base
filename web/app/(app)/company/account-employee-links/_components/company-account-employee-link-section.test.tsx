import { cleanup, render, screen, within } from "@testing-library/react"
import { afterEach, describe, expect, test, vi } from "vite-plus/test"
import type { CompanyResource } from "@/lib/api/types/company-resource-types"
import { CompanyAccountEmployeeLinkSection } from "@/app/(app)/company/account-employee-links/_components/company-account-employee-link-section"

const mocks = vi.hoisted(() => ({ getCompanyAccountEmployeeLinkResources: vi.fn() }))

vi.mock("@/lib/api/get-company-account-employee-link-resources", () => ({
  getCompanyAccountEmployeeLinkResources: mocks.getCompanyAccountEmployeeLinkResources,
}))
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const link: CompanyResource = {
  organizationId: "ad4f6cb1-774b-43ae-950f-80e9bc67c66d",
  type: "account-employee-link",
  id: "link:1",
  revision: 1,
  state: "active",
  effectiveFrom: "2026-04-01",
  effectiveTo: null,
  attributes: { accountId: "account:1", employeeId: "employee:1" },
}

describe("CompanyAccountEmployeeLinkSection", () => {
  test("Account と Employee の対応を 1 行で出す", async () => {
    mocks.getCompanyAccountEmployeeLinkResources.mockResolvedValue({
      organizationId: "ad4f6cb1-774b-43ae-950f-80e9bc67c66d",
      organizationRevision: 2,
      resources: [link],
    })

    render(await CompanyAccountEmployeeLinkSection())

    const rows = screen.getAllByRole("row").slice(1)

    expect(within(rows[0]).getByText("account:1")).toBeDefined()
    expect(within(rows[0]).getByText("employee:1")).toBeDefined()
  })

  test("空のときは登録がないことを示す", async () => {
    mocks.getCompanyAccountEmployeeLinkResources.mockResolvedValue({
      organizationId: "ad4f6cb1-774b-43ae-950f-80e9bc67c66d",
      organizationRevision: 0,
      resources: [],
    })

    render(await CompanyAccountEmployeeLinkSection())

    expect(screen.getByText("Account の対応が登録されていません")).toBeDefined()
    expect(screen.queryByRole("table")).toBeNull()
  })

  test("取得に失敗したときは行を出さない", async () => {
    mocks.getCompanyAccountEmployeeLinkResources.mockResolvedValue(new Error("failed"))

    render(await CompanyAccountEmployeeLinkSection())

    expect(screen.getByText("Account の対応の取得に失敗しました")).toBeDefined()
    expect(screen.queryByRole("table")).toBeNull()
  })
})
