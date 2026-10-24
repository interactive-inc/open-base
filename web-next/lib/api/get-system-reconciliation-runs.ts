import { createClient } from "@/lib/api/hc-client"
import type { SystemReconciliationRun } from "@/lib/api/types/system-operation-types"

/**
 * GET /system/integration-exchanges/:exchangeId/reconciliations。
 * api は SQL の row をそのまま返し型を持たないので、ここで 1 行ずつ形を検査する。
 * 形が合わない行は表示しても意味が読めないため落とす。
 */
export async function getSystemReconciliationRuns(
  exchangeId: string,
): Promise<ReadonlyArray<SystemReconciliationRun> | Error> {
  const client = await createClient()

  const response = await client.system["integration-exchanges"][":exchangeId"][
    "reconciliations"
  ].$get({ param: { exchangeId } })

  if (response.status >= 400) {
    return new Error("failed to load system reconciliation runs")
  }

  const body = await response.json()

  const runs: Array<SystemReconciliationRun> = []

  for (const row of body.reconciliations) {
    const run = toReconciliationRun(row)

    if (run === null) continue

    runs.push(run)
  }

  return runs
}

function toReconciliationRun(row: Record<string, unknown>): SystemReconciliationRun | null {
  if (typeof row.id !== "string") return null

  if (typeof row.exchange_id !== "string") return null

  if (typeof row.assertion_id !== "string") return null

  if (typeof row.local_version !== "string") return null

  if (typeof row.status !== "string") return null

  if (typeof row.created_at !== "number") return null

  if (typeof row.item_count !== "number") return null

  return {
    id: row.id,
    exchange_id: row.exchange_id,
    assertion_id: row.assertion_id,
    local_version: row.local_version,
    status: row.status,
    created_at: row.created_at,
    item_count: row.item_count,
  }
}
