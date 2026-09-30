import { cleanup, render, screen, within } from "@testing-library/react"
import { afterEach, describe, expect, test, vi } from "vite-plus/test"
import type { CompanyResource } from "@/lib/api/types/company-resource-types"
import { CompanyPeopleSection } from "@/app/(app)/company/people/_components/company-people-section"

const mocks = vi.hoisted(() => ({ getCompanyPeopleResources: vi.fn() }))

vi.mock("@/lib/api/get-company-people-resources", () => ({
  getCompanyPeopleResources: mocks.getCompanyPeopleResources,
}))
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const person: CompanyResource = {
  organizationId: "ad4f6cb1-774b-43ae-950f-80e9bc67c66d",
  type: "person",
  id: "person:1",
  revision: 1,
  state: "active",
  effectiveFrom: "2026-04-01",
  effectiveTo: null,
  attributes: { officialName: "山田 太郎", email: "you@example.com", phone: null },
}

describe("CompanyPeopleSection", () => {
  test("氏名と連絡先を出し、欠けた電話はハイフンにする", async () => {
    mocks.getCompanyPeopleResources.mockResolvedValue({
      organizationId: "ad4f6cb1-774b-43ae-950f-80e9bc67c66d",
      organizationRevision: 4,
      resources: [person],
    })

    render(await CompanyPeopleSection())

    const rows = screen.getAllByRole("row").slice(1)

    expect(within(rows[0]).getByText("山田 太郎")).toBeDefined()
    expect(within(rows[0]).getByText("you@example.com")).toBeDefined()
    expect(within(rows[0]).getByText("person:1")).toBeDefined()
    expect(within(rows[0]).getByText("-")).toBeDefined()
  })

  test("空のときは登録がないことを示す", async () => {
    mocks.getCompanyPeopleResources.mockResolvedValue({
      organizationId: "ad4f6cb1-774b-43ae-950f-80e9bc67c66d",
      organizationRevision: 0,
      resources: [],
    })

    render(await CompanyPeopleSection())

    expect(screen.getByText("人が登録されていません")).toBeDefined()
    expect(screen.queryByRole("table")).toBeNull()
  })

  test("取得に失敗したときは行を出さない", async () => {
    mocks.getCompanyPeopleResources.mockResolvedValue(new Error("failed"))

    render(await CompanyPeopleSection())

    expect(screen.getByText("人の取得に失敗しました")).toBeDefined()
    expect(screen.queryByRole("table")).toBeNull()
  })
})
