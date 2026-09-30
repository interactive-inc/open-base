import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, test, vi } from "vite-plus/test"
import type { SystemIntegrationExchange } from "@/lib/api/types/system-operation-types"
import { SystemIntegrationExchangeSection } from "@/app/(app)/system/integration-exchanges/_components/system-integration-exchange-section"

const mocks = vi.hoisted(() => ({ getSystemIntegrationExchanges: vi.fn() }))

vi.mock("@/lib/api/get-system-integration-exchanges", () => ({
  getSystemIntegrationExchanges: mocks.getSystemIntegrationExchanges,
}))
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const failedExchange: SystemIntegrationExchange = {
  id: "exchange-1",
  connectorId: "connector-1",
  direction: "outbound",
  operationKey: "payroll.export",
  idempotencyKey: "key-1",
  payloadDigest: "a".repeat(64),
  status: "failed",
  attempt: 2,
  externalReference: null,
  lastErrorCode: "external_timeout",
}

describe("SystemIntegrationExchangeSection", () => {
  test("状態を日本語にし、操作を詳細へ繋ぐ", async () => {
    mocks.getSystemIntegrationExchanges.mockResolvedValue([failedExchange])

    render(await SystemIntegrationExchangeSection({ connectorId: "connector-1" }))

    expect(screen.getByRole("cell", { name: "失敗" })).toBeDefined()
    expect(screen.getByRole("cell", { name: "external_timeout" })).toBeDefined()
    expect(screen.getByRole("link", { name: "payroll.export" }).getAttribute("href")).toBe(
      "/system/integration-exchanges/exchange-1",
    )
  })

  test("選んだコネクタをそのまま api へ渡す", async () => {
    mocks.getSystemIntegrationExchanges.mockResolvedValue([])

    render(await SystemIntegrationExchangeSection({ connectorId: "connector-2" }))

    expect(mocks.getSystemIntegrationExchanges).toHaveBeenCalledWith("connector-2")
  })

  test("1 件も無いときは交換が無いことを示す", async () => {
    mocks.getSystemIntegrationExchanges.mockResolvedValue([])

    render(await SystemIntegrationExchangeSection({ connectorId: "connector-1" }))

    expect(screen.getByText("外部交換がありません")).toBeDefined()
    expect(screen.queryByRole("table")).toBeNull()
  })

  test("取得に失敗したときは行を出さない", async () => {
    mocks.getSystemIntegrationExchanges.mockResolvedValue(new Error("failed"))

    render(await SystemIntegrationExchangeSection({ connectorId: "connector-1" }))

    expect(screen.getByText("外部交換の取得に失敗しました")).toBeDefined()
    expect(screen.queryByRole("table")).toBeNull()
  })
})
