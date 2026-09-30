import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, test, vi } from "vite-plus/test"
import type { CompanyResource } from "@/lib/api/types/company-resource-types"
import { CompanyProfileSection } from "@/app/(app)/company/profile/_components/company-profile-section"

const mocks = vi.hoisted(() => ({ getCompanyProfileResources: vi.fn() }))

vi.mock("@/lib/api/get-company-profile-resources", () => ({
  getCompanyProfileResources: mocks.getCompanyProfileResources,
}))
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const legalEntity: CompanyResource = {
  organizationId: "ad4f6cb1-774b-43ae-950f-80e9bc67c66d",
  type: "legal-entity",
  id: "legal-entity:main",
  revision: 1,
  state: "active",
  effectiveFrom: "2026-04-01",
  effectiveTo: null,
  attributes: {
    officialName: "サンプル株式会社",
    jurisdictionCountryCode: "JP",
    registrationNumber: null,
    defaultCurrencyCode: "JPY",
  },
}

const companyProfile: CompanyResource = {
  organizationId: "ad4f6cb1-774b-43ae-950f-80e9bc67c66d",
  type: "company-profile",
  id: "company-profile:main",
  revision: 1,
  state: "active",
  effectiveFrom: "2026-04-01",
  effectiveTo: null,
  attributes: {
    displayName: "サンプル",
    locale: "ja-JP",
    timeZone: "Asia/Tokyo",
    fiscalYearStartMonth: 4,
  },
}

describe("CompanyProfileSection", () => {
  test("法人と会社プロフィールを並べ、未設定の属性はハイフンにする", async () => {
    mocks.getCompanyProfileResources.mockResolvedValue({
      organizationId: "ad4f6cb1-774b-43ae-950f-80e9bc67c66d",
      organizationRevision: 12,
      resources: [legalEntity, companyProfile],
    })

    render(await CompanyProfileSection())

    expect(screen.getByText("サンプル株式会社")).toBeDefined()
    expect(screen.getByText("JP")).toBeDefined()
    expect(screen.getByText("JPY")).toBeDefined()
    expect(screen.getByText("Asia/Tokyo")).toBeDefined()
    expect(screen.getByText("4 月")).toBeDefined()
    expect(screen.getAllByText("-").length).toBeGreaterThan(0)
  })

  test("空のときは登録がないことを両方の表で示す", async () => {
    mocks.getCompanyProfileResources.mockResolvedValue({
      organizationId: "ad4f6cb1-774b-43ae-950f-80e9bc67c66d",
      organizationRevision: 0,
      resources: [],
    })

    render(await CompanyProfileSection())

    expect(screen.getByText("法人が登録されていません")).toBeDefined()
    expect(screen.getByText("会社プロフィールが登録されていません")).toBeDefined()
    expect(screen.queryByRole("table")).toBeNull()
  })

  test("取得に失敗したときは部分的な内容を出さない", async () => {
    mocks.getCompanyProfileResources.mockResolvedValue(new Error("failed"))

    render(await CompanyProfileSection())

    expect(screen.getByText("会社と法人の取得に失敗しました")).toBeDefined()
    expect(screen.queryByText("サンプル株式会社")).toBeNull()
  })
})
