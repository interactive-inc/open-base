import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, test, vi } from "vite-plus/test"
import type { CompanyResource } from "@/lib/api/types/company-resource-types"
import { CompanyOrganizationSnapshotSection } from "@/app/(app)/company/organization-snapshots/_components/company-organization-snapshot-section"

const mocks = vi.hoisted(() => ({ getCompanyOrganizationSnapshot: vi.fn() }))

vi.mock("@/lib/api/get-company-organization-snapshot", () => ({
  getCompanyOrganizationSnapshot: mocks.getCompanyOrganizationSnapshot,
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

describe("CompanyOrganizationSnapshotSection", () => {
  test("最上位の組織単位は親を持たないことを言葉で示す", async () => {
    mocks.getCompanyOrganizationSnapshot.mockResolvedValue({
      organizationId: "ad4f6cb1-774b-43ae-950f-80e9bc67c66d",
      organizationRevision: 9,
      resources: [
        toResource({
          type: "organization-unit",
          id: "unit:1",
          attributes: {
            organizationUnitId: "unit:1",
            code: "D001",
            officialName: "開発部",
            kind: "DEPARTMENT",
            parentOrganizationUnitId: null,
          },
        }),
      ],
    })

    render(await CompanyOrganizationSnapshotSection({ effectiveOn: null }))

    expect(screen.getByText("開発部")).toBeDefined()
    expect(screen.getByText("（最上位）")).toBeDefined()
    expect(screen.getByText("組織 revision 9 時点の内容です。")).toBeDefined()
  })

  test("組織単位のコードは部署ハブへ辿れる", async () => {
    mocks.getCompanyOrganizationSnapshot.mockResolvedValue({
      organizationId: "ad4f6cb1-774b-43ae-950f-80e9bc67c66d",
      organizationRevision: 9,
      resources: [
        toResource({
          type: "organization-unit",
          id: "unit:1",
          attributes: {
            organizationUnitId: "unit:1",
            code: "D001",
            officialName: "開発部",
            kind: "DEPARTMENT",
            parentOrganizationUnitId: null,
          },
        }),
      ],
    })

    render(await CompanyOrganizationSnapshotSection({ effectiveOn: null }))

    expect(screen.getByRole("link", { name: "D001" }).getAttribute("href")).toBe("/teams/D001")
  })

  test("コードを持たない組織単位はリンクにしない", async () => {
    mocks.getCompanyOrganizationSnapshot.mockResolvedValue({
      organizationId: "ad4f6cb1-774b-43ae-950f-80e9bc67c66d",
      organizationRevision: 9,
      resources: [
        toResource({
          type: "organization-unit",
          id: "unit:2",
          attributes: { organizationUnitId: "unit:2", parentOrganizationUnitId: null },
        }),
      ],
    })

    render(await CompanyOrganizationSnapshotSection({ effectiveOn: null }))

    expect(screen.queryByRole("link")).toBeNull()
  })

  test("再委任の可否を日本語にする", async () => {
    mocks.getCompanyOrganizationSnapshot.mockResolvedValue({
      organizationId: "ad4f6cb1-774b-43ae-950f-80e9bc67c66d",
      organizationRevision: 9,
      resources: [
        toResource({
          type: "responsibility-assignment",
          id: "assignment:1",
          attributes: {
            responsibilityId: "responsibility:1",
            holderType: "employee",
            holderId: "employee:1",
            authorityScopeId: null,
            delegationAllowed: false,
          },
        }),
      ],
    })

    render(await CompanyOrganizationSnapshotSection({ effectiveOn: "2026-04-01" }))

    expect(screen.getByText("不可")).toBeDefined()
  })

  test("基準日をそのまま api へ渡す", async () => {
    mocks.getCompanyOrganizationSnapshot.mockResolvedValue({
      organizationId: "ad4f6cb1-774b-43ae-950f-80e9bc67c66d",
      organizationRevision: 9,
      resources: [],
    })

    render(await CompanyOrganizationSnapshotSection({ effectiveOn: "2026-10-01" }))

    expect(mocks.getCompanyOrganizationSnapshot).toHaveBeenCalledWith({
      effectiveOn: "2026-10-01",
    })
  })

  test("その時点の登録が無いときは 4 つすべての表で空を示す", async () => {
    mocks.getCompanyOrganizationSnapshot.mockResolvedValue({
      organizationId: "ad4f6cb1-774b-43ae-950f-80e9bc67c66d",
      organizationRevision: 0,
      resources: [],
    })

    render(await CompanyOrganizationSnapshotSection({ effectiveOn: null }))

    expect(screen.getByText("組織単位がありません")).toBeDefined()
    expect(screen.getByText("配属がありません")).toBeDefined()
    expect(screen.getByText("レポートラインがありません")).toBeDefined()
    expect(screen.getByText("責任の割当がありません")).toBeDefined()
  })

  test("取得に失敗したときは部分的な内容を出さない", async () => {
    mocks.getCompanyOrganizationSnapshot.mockResolvedValue(new Error("failed"))

    render(await CompanyOrganizationSnapshotSection({ effectiveOn: null }))

    expect(screen.getByText("組織の時点断面の取得に失敗しました")).toBeDefined()
    expect(screen.queryByRole("table")).toBeNull()
  })
})
