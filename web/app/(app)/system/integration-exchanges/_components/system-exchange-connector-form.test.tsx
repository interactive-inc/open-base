import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, test, vi } from "vite-plus/test"
import type { SystemConnector } from "@/lib/api/types/system-operation-types"
import { SystemExchangeConnectorForm } from "@/app/(app)/system/integration-exchanges/_components/system-exchange-connector-form"

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
  direction: "outbound",
  transport: "api",
  status: "active",
  revision: 1,
}

describe("SystemExchangeConnectorForm", () => {
  test("コネクタを選択肢にする", async () => {
    mocks.getSystemConnectors.mockResolvedValue([connector])

    render(await SystemExchangeConnectorForm({ connectorId: "connector-1" }))

    expect(screen.getByRole("option", { name: "給与の連携" })).toBeDefined()
    expect(screen.getByRole("combobox").getAttribute("name")).toBe("connector_id")
  })

  test("コネクタが 1 件も無いときは選択肢を出さない", async () => {
    mocks.getSystemConnectors.mockResolvedValue([])

    render(await SystemExchangeConnectorForm({ connectorId: null }))

    expect(screen.getByText("コネクタが登録されていません")).toBeDefined()
    expect(screen.queryByRole("combobox")).toBeNull()
  })

  test("取得に失敗したときは選択肢を出さない", async () => {
    mocks.getSystemConnectors.mockResolvedValue(new Error("failed"))

    render(await SystemExchangeConnectorForm({ connectorId: null }))

    expect(screen.getByText("コネクタの取得に失敗しました")).toBeDefined()
    expect(screen.queryByRole("combobox")).toBeNull()
  })
})
