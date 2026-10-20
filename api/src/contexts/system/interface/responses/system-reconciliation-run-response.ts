import type { ReconciliationRunEntity } from "@system/domain/entities/reconciliation-run.entity"

/** 照合の記録をHTTP応答と監査で共通の形式へ変換する。 */
export function systemReconciliationRunResponse(run: ReconciliationRunEntity) {
  return {
    id: run.id,
    exchange_id: run.exchangeId,
    assertion_id: run.assertionId,
    local_version: run.localVersion,
    status: run.status,
    item_count: run.items.length,
    created_at: run.createdAt.toISOString(),
  }
}
