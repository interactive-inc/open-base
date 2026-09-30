import { cleanup, render, screen, within } from "@testing-library/react"
import { afterEach, describe, expect, test } from "vite-plus/test"
import { CompanyResourceTable } from "@/components/company-resource-table"
import type { CompanyResource } from "@/lib/api/types/company-resource-types"
import { readResourceText } from "@/lib/company/read-resource-text"

afterEach(cleanup)

const baseResource: CompanyResource = {
  organizationId: "ad4f6cb1-774b-43ae-950f-80e9bc67c66d",
  type: "site",
  id: "site:head-office",
  revision: 3,
  state: "active",
  effectiveFrom: "2026-04-01",
  effectiveTo: null,
  attributes: { code: "HQ", officialName: "本社" },
}

const columns = [
  {
    header: "コード",
    toValue: (resource: CompanyResource) => readResourceText(resource, "code") ?? "-",
  },
]

describe("CompanyResourceTable", () => {
  test("空のときは登録がないことと変更手段を示す", () => {
    render(
      <CompanyResourceTable
        caption="事業所の一覧"
        columns={columns}
        resources={[]}
        emptyTitle="事業所が登録されていません"
        emptyDescription="正本は API と CLI が持ちます。"
      />,
    )

    expect(screen.getByText("事業所が登録されていません")).toBeDefined()
    expect(screen.queryByRole("table")).toBeNull()
  })

  test("有効期間は終了日が null のとき開いたまま示し、状態を日本語にする", () => {
    render(
      <CompanyResourceTable
        caption="事業所の一覧"
        columns={columns}
        resources={[
          baseResource,
          {
            ...baseResource,
            id: "site:branch",
            state: "void",
            effectiveTo: "2027-03-31",
            attributes: { code: "BR" },
          },
        ]}
        emptyTitle="事業所が登録されていません"
        emptyDescription="正本は API と CLI が持ちます。"
      />,
    )

    const rows = screen.getAllByRole("row").slice(1)

    expect(within(rows[0]).getByText("HQ")).toBeDefined()
    expect(within(rows[0]).getByText("2026-04-01 〜")).toBeDefined()
    expect(within(rows[0]).getByText("有効")).toBeDefined()

    expect(within(rows[1]).getByText("2026-04-01 〜 2027-03-31")).toBeDefined()
    expect(within(rows[1]).getByText("無効")).toBeDefined()
  })

  test("読み取り専用なので操作列を持たない", () => {
    render(
      <CompanyResourceTable
        caption="事業所の一覧"
        columns={columns}
        resources={[baseResource]}
        emptyTitle="事業所が登録されていません"
        emptyDescription="正本は API と CLI が持ちます。"
      />,
    )

    expect(screen.queryByRole("button")).toBeNull()
    expect(screen.queryByRole("link")).toBeNull()
    expect(screen.getAllByRole("columnheader").map((header) => header.textContent)).toEqual([
      "コード",
      "有効期間",
      "状態",
    ])
  })
})
