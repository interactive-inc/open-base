import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, test, vi } from "vite-plus/test"
import type { CompanyResource } from "@/lib/api/types/company-resource-types"
import { CompanySiteSection } from "@/app/(app)/company/profile/_components/company-site-section"

const mocks = vi.hoisted(() => ({ getCompanyDefinitionResources: vi.fn() }))

vi.mock("@/lib/api/get-company-definition-resources", () => ({
  getCompanyDefinitionResources: mocks.getCompanyDefinitionResources,
}))
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const site: CompanyResource = {
  organizationId: "ad4f6cb1-774b-43ae-950f-80e9bc67c66d",
  type: "site",
  id: "site:1",
  revision: 1,
  state: "active",
  effectiveFrom: "2026-04-01",
  effectiveTo: null,
  attributes: {
    code: "HQ",
    officialName: "本社",
    legalEntityId: "legal-entity:1",
    kind: "physical",
    timeZone: "Asia/Tokyo",
    countryCode: "JP",
  },
}

const workplace: CompanyResource = {
  organizationId: "ad4f6cb1-774b-43ae-950f-80e9bc67c66d",
  type: "workplace",
  id: "workplace:1",
  revision: 1,
  state: "active",
  effectiveFrom: "2026-04-01",
  effectiveTo: null,
  attributes: { code: "HQ-1", officialName: "本社オフィス", siteId: "site:1", kind: "office" },
}

describe("CompanySiteSection", () => {
  test("事業所と勤務場所を分けて出す", async () => {
    mocks.getCompanyDefinitionResources.mockResolvedValue({
      organizationId: "ad4f6cb1-774b-43ae-950f-80e9bc67c66d",
      organizationRevision: 6,
      resources: [site, workplace],
    })

    render(await CompanySiteSection())

    expect(screen.getByText("本社")).toBeDefined()
    expect(screen.getByText("本社オフィス")).toBeDefined()
    expect(screen.getByText("physical")).toBeDefined()
    expect(screen.getByText("office")).toBeDefined()
  })

  test("職務や責任の定義は同じ api から来てもここには出さない", async () => {
    mocks.getCompanyDefinitionResources.mockResolvedValue({
      organizationId: "ad4f6cb1-774b-43ae-950f-80e9bc67c66d",
      organizationRevision: 6,
      resources: [
        site,
        {
          ...site,
          type: "job",
          id: "job:1",
          attributes: { code: "J01", officialName: "職務テスト" },
        },
      ],
    })

    render(await CompanySiteSection())

    expect(screen.queryByText("職務テスト")).toBeNull()
  })

  test("空のときは両方の表で登録がないことを示す", async () => {
    mocks.getCompanyDefinitionResources.mockResolvedValue({
      organizationId: "ad4f6cb1-774b-43ae-950f-80e9bc67c66d",
      organizationRevision: 0,
      resources: [],
    })

    render(await CompanySiteSection())

    expect(screen.getByText("事業所が登録されていません")).toBeDefined()
    expect(screen.getByText("勤務場所が登録されていません")).toBeDefined()
  })

  test("取得に失敗したときは部分的な内容を出さない", async () => {
    mocks.getCompanyDefinitionResources.mockResolvedValue(new Error("failed"))

    render(await CompanySiteSection())

    expect(screen.getByText("事業所と勤務場所の取得に失敗しました")).toBeDefined()
    expect(screen.queryByRole("table")).toBeNull()
  })
})
