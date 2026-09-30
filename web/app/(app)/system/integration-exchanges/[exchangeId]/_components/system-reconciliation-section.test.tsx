import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, test, vi } from "vite-plus/test"
import type { SystemReconciliationRun } from "@/lib/api/types/system-operation-types"
import { SystemReconciliationSection } from "@/app/(app)/system/integration-exchanges/[exchangeId]/_components/system-reconciliation-section"

const mocks = vi.hoisted(() => ({ getSystemReconciliationRuns: vi.fn() }))

vi.mock("@/lib/api/get-system-reconciliation-runs", () => ({
  getSystemReconciliationRuns: mocks.getSystemReconciliationRuns,
}))
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const run: SystemReconciliationRun = {
  id: "run-1",
  exchange_id: "exchange-1",
  assertion_id: "assertion-1",
  local_version: "v3",
  status: "matched",
  created_at: Date.UTC(2026, 3, 1),
  item_count: 12,
}

describe("SystemReconciliationSection", () => {
  test("項目数と epoch の記録時刻を出す", async () => {
    mocks.getSystemReconciliationRuns.mockResolvedValue([run])

    render(await SystemReconciliationSection({ exchangeId: "exchange-1" }))

    expect(screen.getByRole("cell", { name: "12" })).toBeDefined()
    expect(screen.getByRole("cell", { name: "v3" })).toBeDefined()
    expect(screen.getByRole("cell", { name: "2026/04/01 09:00" })).toBeDefined()
  })

  test("1 件も無いときは照合が無いことを示す", async () => {
    mocks.getSystemReconciliationRuns.mockResolvedValue([])

    render(await SystemReconciliationSection({ exchangeId: "exchange-1" }))

    expect(screen.getByText("照合がありません")).toBeDefined()
    expect(screen.queryByRole("table")).toBeNull()
  })

  test("取得に失敗したときは行を出さない", async () => {
    mocks.getSystemReconciliationRuns.mockResolvedValue(new Error("failed"))

    render(await SystemReconciliationSection({ exchangeId: "exchange-1" }))

    expect(screen.getByText("照合の取得に失敗しました")).toBeDefined()
    expect(screen.queryByRole("table")).toBeNull()
  })
})
