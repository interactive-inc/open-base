import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, test, vi } from "vite-plus/test"
import type { CompanyResource } from "@/lib/api/types/company-resource-types"
import { CompanyDefinitionSection } from "@/app/(app)/company/definitions/_components/company-definition-section"

const mocks = vi.hoisted(() => ({ getCompanyDefinitionResources: vi.fn() }))

vi.mock("@/lib/api/get-company-definition-resources", () => ({
  getCompanyDefinitionResources: mocks.getCompanyDefinitionResources,
}))
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

function toResource(props: {
  type: CompanyResource["type"]
  id: string
  attributes: Readonly<Record<string, unknown>>
}): CompanyResource {
  return {
    organizationId: "ad4f6cb1-774b-43ae-950f-80e9bc67c66d",
    type: props.type,
    id: props.id,
    revision: 1,
    state: "active",
    effectiveFrom: "2026-04-01",
    effectiveTo: null,
    attributes: props.attributes,
  }
}

describe("CompanyDefinitionSection", () => {
  test("職務・役職・責任・権限範囲・合議体を種別ごとに分けて出す", async () => {
    mocks.getCompanyDefinitionResources.mockResolvedValue({
      organizationId: "ad4f6cb1-774b-43ae-950f-80e9bc67c66d",
      organizationRevision: 7,
      resources: [
        toResource({ type: "job", id: "job:1", attributes: { code: "J01", officialName: "開発" } }),
        toResource({
          type: "organizational-office",
          id: "office:1",
          attributes: {
            code: "O01",
            officialName: "開発部長",
            organizationUnitId: "unit:1",
            positionId: "position:1",
          },
        }),
        toResource({
          type: "responsibility",
          id: "responsibility:1",
          attributes: { code: "R01", officialName: "予算承認" },
        }),
        toResource({
          type: "collective-body",
          id: "body:1",
          attributes: {
            code: "C01",
            officialName: "役員会",
            quorumType: "count",
            quorumValue: 3,
            decisionRule: "majority",
          },
        }),
      ],
    })

    render(await CompanyDefinitionSection())

    expect(screen.getByText("開発")).toBeDefined()
    expect(screen.getByText("開発部長")).toBeDefined()
    expect(screen.getByText("予算承認")).toBeDefined()
    expect(screen.getByText("役員会")).toBeDefined()
    expect(screen.getByText("3 名")).toBeDefined()
  })

  test("等級と役職マスタは別の画面が正本なのでここには出さない", async () => {
    mocks.getCompanyDefinitionResources.mockResolvedValue({
      organizationId: "ad4f6cb1-774b-43ae-950f-80e9bc67c66d",
      organizationRevision: 7,
      resources: [
        toResource({
          type: "grade",
          id: "grade:1",
          attributes: { code: "G01", officialName: "等級テスト" },
        }),
        toResource({
          type: "position",
          id: "position:1",
          attributes: { code: "P01", officialName: "役職テスト" },
        }),
      ],
    })

    render(await CompanyDefinitionSection())

    expect(screen.queryByText("等級テスト")).toBeNull()
    expect(screen.queryByText("役職テスト")).toBeNull()
  })

  test("空のときは 5 つすべての表で登録がないことを示す", async () => {
    mocks.getCompanyDefinitionResources.mockResolvedValue({
      organizationId: "ad4f6cb1-774b-43ae-950f-80e9bc67c66d",
      organizationRevision: 0,
      resources: [],
    })

    render(await CompanyDefinitionSection())

    expect(screen.getByText("職務が登録されていません")).toBeDefined()
    expect(screen.getByText("組織上の役職が登録されていません")).toBeDefined()
    expect(screen.getByText("責任が登録されていません")).toBeDefined()
    expect(screen.getByText("権限範囲が登録されていません")).toBeDefined()
    expect(screen.getByText("合議体が登録されていません")).toBeDefined()
  })

  test("取得に失敗したときは部分的な内容を出さない", async () => {
    mocks.getCompanyDefinitionResources.mockResolvedValue(new Error("failed"))

    render(await CompanyDefinitionSection())

    expect(screen.getByText("職務と責任の取得に失敗しました")).toBeDefined()
    expect(screen.queryByRole("table")).toBeNull()
  })
})
