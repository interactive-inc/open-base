import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, test, vi } from "vite-plus/test"
import type { CompanyResource } from "@/lib/api/types/company-resource-types"
import { CompanyEmploymentSection } from "@/app/(app)/company/employments/_components/company-employment-section"

const mocks = vi.hoisted(() => ({ getCompanyEmploymentResources: vi.fn() }))

vi.mock("@/lib/api/get-company-employment-resources", () => ({
  getCompanyEmploymentResources: mocks.getCompanyEmploymentResources,
}))
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const activeEmployment: CompanyResource = {
  organizationId: "ad4f6cb1-774b-43ae-950f-80e9bc67c66d",
  type: "employment",
  id: "employment:1",
  revision: 1,
  state: "active",
  effectiveFrom: "2026-04-01",
  effectiveTo: null,
  attributes: { employeeId: "employee:1", status: "ACTIVE", employmentType: "full-time" },
}

const terminatedEmployment: CompanyResource = {
  organizationId: "ad4f6cb1-774b-43ae-950f-80e9bc67c66d",
  type: "employment",
  id: "employment:2",
  revision: 1,
  state: "active",
  effectiveFrom: "2025-04-01",
  effectiveTo: "2026-03-31",
  attributes: { employeeId: "employee:2", status: "TERMINATED" },
}

describe("CompanyEmploymentSection", () => {
  test("在籍区分を日本語にし、雇用形態が無い行はハイフンにする", async () => {
    mocks.getCompanyEmploymentResources.mockResolvedValue({
      organizationId: "ad4f6cb1-774b-43ae-950f-80e9bc67c66d",
      organizationRevision: 5,
      resources: [activeEmployment, terminatedEmployment],
    })

    render(await CompanyEmploymentSection({ status: null }))

    expect(screen.getByText("在籍")).toBeDefined()
    expect(screen.getByText("退職")).toBeDefined()
    expect(screen.getByText("full-time")).toBeDefined()
    expect(screen.getAllByRole("row").slice(1)).toHaveLength(2)
  })

  test("status を指定すると api が絞り込みを持たないぶんを取得後に絞る", async () => {
    mocks.getCompanyEmploymentResources.mockResolvedValue({
      organizationId: "ad4f6cb1-774b-43ae-950f-80e9bc67c66d",
      organizationRevision: 5,
      resources: [activeEmployment, terminatedEmployment],
    })

    render(await CompanyEmploymentSection({ status: "TERMINATED" }))

    expect(screen.getAllByRole("row").slice(1)).toHaveLength(1)
    expect(screen.getByText("退職")).toBeDefined()
    expect(screen.queryByText("在籍")).toBeNull()
  })

  test("絞り込みの結果が空でも登録の手段を示す", async () => {
    mocks.getCompanyEmploymentResources.mockResolvedValue({
      organizationId: "ad4f6cb1-774b-43ae-950f-80e9bc67c66d",
      organizationRevision: 5,
      resources: [],
    })

    render(await CompanyEmploymentSection({ status: null }))

    expect(screen.getByText("雇用が登録されていません")).toBeDefined()
    expect(screen.queryByRole("table")).toBeNull()
  })

  test("取得に失敗したときは行を出さない", async () => {
    mocks.getCompanyEmploymentResources.mockResolvedValue(new Error("failed"))

    render(await CompanyEmploymentSection({ status: null }))

    expect(screen.getByText("雇用の取得に失敗しました")).toBeDefined()
    expect(screen.queryByRole("table")).toBeNull()
  })
})
