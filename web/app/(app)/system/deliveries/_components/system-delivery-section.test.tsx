import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, test, vi } from "vite-plus/test"
import type { SystemDelivery } from "@/lib/api/types/system-operation-types"
import { SystemDeliverySection } from "@/app/(app)/system/deliveries/_components/system-delivery-section"

const mocks = vi.hoisted(() => ({ getSystemDeliveries: vi.fn() }))

vi.mock("@/lib/api/get-system-deliveries", () => ({
  getSystemDeliveries: mocks.getSystemDeliveries,
}))
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const queuedDelivery: SystemDelivery = {
  id: "delivery-1",
  kind: "job",
  operation_key: "notification.send",
  payload_digest: "a".repeat(64),
  idempotency_key: "key-1",
  status: "queued",
  attempt: 1,
  max_attempts: 5,
  available_at: "2026-04-01T00:00:00.000Z",
  lease_account_id: null,
  lease_expires_at: null,
  last_error_code: null,
  created_at: "2026-04-01T00:00:00.000Z",
  updated_at: "2026-04-01T00:00:00.000Z",
  completed_at: null,
}

describe("SystemDeliverySection", () => {
  test("状態を日本語にし、試行を上限と並べて出す", async () => {
    mocks.getSystemDeliveries.mockResolvedValue([queuedDelivery])

    render(await SystemDeliverySection({ kind: "job", status: null }))

    expect(screen.getByRole("cell", { name: "notification.send" })).toBeDefined()
    expect(screen.getByRole("cell", { name: "待機" })).toBeDefined()
    expect(screen.getByRole("cell", { name: "1 / 5" })).toBeDefined()
  })

  test("選んだ種別と状態をそのまま api へ渡す", async () => {
    mocks.getSystemDeliveries.mockResolvedValue([])

    render(await SystemDeliverySection({ kind: "outbox", status: "dead_letter" }))

    expect(mocks.getSystemDeliveries).toHaveBeenCalledWith({
      kind: "outbox",
      status: "dead_letter",
    })
  })

  test("1 件も無いときは絞り込みの変更を促す", async () => {
    mocks.getSystemDeliveries.mockResolvedValue([])

    render(await SystemDeliverySection({ kind: "job", status: null }))

    expect(screen.getByText("配信がありません")).toBeDefined()
    expect(screen.queryByRole("table")).toBeNull()
  })

  test("取得に失敗したときは行を出さない", async () => {
    mocks.getSystemDeliveries.mockResolvedValue(new Error("failed"))

    render(await SystemDeliverySection({ kind: "job", status: null }))

    expect(screen.getByText("配信の取得に失敗しました")).toBeDefined()
    expect(screen.queryByRole("table")).toBeNull()
  })
})
