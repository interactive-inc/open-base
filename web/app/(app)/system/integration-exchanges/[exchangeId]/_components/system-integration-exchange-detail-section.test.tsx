import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, test, vi } from "vite-plus/test"
import type { SystemIntegrationExchange } from "@/lib/api/types/system-operation-types"
import { SystemIntegrationExchangeDetailSection } from "@/app/(app)/system/integration-exchanges/[exchangeId]/_components/system-integration-exchange-detail-section"

const mocks = vi.hoisted(() => ({ getSystemIntegrationExchange: vi.fn() }))

vi.mock("@/lib/api/get-system-integration-exchange", () => ({
  getSystemIntegrationExchange: mocks.getSystemIntegrationExchange,
}))
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const exchange: SystemIntegrationExchange = {
  id: "exchange-1",
  connectorId: "connector-1",
  direction: "inbound",
  operationKey: "attendance.import",
  idempotencyKey: "key-1",
  payloadDigest: "a".repeat(64),
  status: "succeeded",
  attempt: 1,
  externalReference: "external-1",
  lastErrorCode: null,
}

describe("SystemIntegrationExchangeDetailSection", () => {
  test("状態を日本語にし、コネクタへ繋ぐ", async () => {
    mocks.getSystemIntegrationExchange.mockResolvedValue(exchange)

    render(await SystemIntegrationExchangeDetailSection({ exchangeId: "exchange-1" }))

    expect(screen.getByText("成功")).toBeDefined()
    expect(screen.getByText("受信")).toBeDefined()
    expect(screen.getByRole("link", { name: "connector-1" }).getAttribute("href")).toBe(
      "/system/connectors/connector-1",
    )
  })

  test("エラーが無いときはハイフンにする", async () => {
    mocks.getSystemIntegrationExchange.mockResolvedValue(exchange)

    render(await SystemIntegrationExchangeDetailSection({ exchangeId: "exchange-1" }))

    expect(screen.getByText("-")).toBeDefined()
    expect(screen.getByText("external-1")).toBeDefined()
  })

  test("取得に失敗したときは属性を出さない", async () => {
    mocks.getSystemIntegrationExchange.mockResolvedValue(new Error("failed"))

    render(await SystemIntegrationExchangeDetailSection({ exchangeId: "exchange-1" }))

    expect(screen.getByText("外部交換の取得に失敗しました")).toBeDefined()
    expect(screen.queryByText("attendance.import")).toBeNull()
  })
})
