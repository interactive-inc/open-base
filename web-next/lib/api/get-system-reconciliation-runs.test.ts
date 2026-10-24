import { afterEach, describe, expect, test, vi } from "vite-plus/test"
import { getSystemReconciliationRuns } from "@/lib/api/get-system-reconciliation-runs"

const mocks = vi.hoisted(() => ({ getServerSession: vi.fn() }))

vi.mock("@/lib/auth/get-server-session", () => ({
  getServerSession: mocks.getServerSession,
}))

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

const validRow = {
  id: "run-1",
  exchange_id: "exchange-1",
  assertion_id: "assertion-1",
  local_version: "v1",
  status: "matched",
  created_at: 1_775_000_000_000,
  item_count: 4,
}

function stubResponse(body: unknown, status = 200) {
  mocks.getServerSession.mockResolvedValue("fixture-session")
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(body, { status })))
}

describe("getSystemReconciliationRuns", () => {
  test("形の揃った行だけを返す", async () => {
    stubResponse({ reconciliations: [validRow] })

    const runs = await getSystemReconciliationRuns("exchange-1")

    expect(runs).toEqual([validRow])
  })

  test("api は型を持たないので、形の合わない行は落とす", async () => {
    stubResponse({
      reconciliations: [
        validRow,
        { ...validRow, id: "run-2", created_at: "2026-04-01T00:00:00.000Z" },
        { ...validRow, id: "run-3", item_count: null },
        { id: "run-4" },
      ],
    })

    const runs = await getSystemReconciliationRuns("exchange-1")

    expect(runs).toEqual([validRow])
  })

  test("api が失敗したら Error を返す", async () => {
    stubResponse({ error: "forbidden" }, 403)

    const runs = await getSystemReconciliationRuns("exchange-1")

    expect(runs).toBeInstanceOf(Error)
  })
})
