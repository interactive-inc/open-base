import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, test, vi } from "vite-plus/test"
import type { SystemConnector } from "@/lib/api/types/system-operation-types"
import { SystemConnectorDetailSection } from "@/app/(app)/system/connectors/[connectorId]/_components/system-connector-detail-section"

const mocks = vi.hoisted(() => ({ getSystemConnectors: vi.fn() }))

vi.mock("@/lib/api/get-system-connectors", () => ({
  getSystemConnectors: mocks.getSystemConnectors,
}))
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const connector: SystemConnector = {
  id: "connector-1",
  key: "payroll_export",
  name: "給与の連携",
  direction: "bidirectional",
  transport: "webhook",
  status: "active",
  revision: 2,
}

describe("SystemConnectorDetailSection", () => {
  test("一覧から識別子で選び、外部交換へ繋ぐ", async () => {
    mocks.getSystemConnectors.mockResolvedValue([connector])

    render(await SystemConnectorDetailSection({ connectorId: "connector-1" }))

    expect(screen.getByText("給与の連携")).toBeDefined()
    expect(screen.getByText("双方向")).toBeDefined()
    expect(
      screen.getByRole("link", { name: "このコネクタの外部交換を見る" }).getAttribute("href"),
    ).toBe("/system/integration-exchanges?connector_id=connector-1")
  })

  test("識別子に合うコネクタが無いときは選び直しを促す", async () => {
    mocks.getSystemConnectors.mockResolvedValue([connector])

    render(await SystemConnectorDetailSection({ connectorId: "connector-9" }))

    expect(screen.getByText("コネクタが見つかりません")).toBeDefined()
    expect(screen.queryByText("給与の連携")).toBeNull()
  })

  test("取得に失敗したときは属性を出さない", async () => {
    mocks.getSystemConnectors.mockResolvedValue(new Error("failed"))

    render(await SystemConnectorDetailSection({ connectorId: "connector-1" }))

    expect(screen.getByText("コネクタの取得に失敗しました")).toBeDefined()
    expect(screen.queryByText("給与の連携")).toBeNull()
  })
})
