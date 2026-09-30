import type { AuditExportRequest, AuditOutcome } from "@/lib/api/types/audit-types"
import { exactSecondEpoch } from "@/app/(app)/system/audit-events/_lib/exact-second-epoch"
import { isOpaqueAccountId } from "@/app/(app)/system/audit-events/_lib/is-opaque-account-id"
import { outcomes } from "@/app/(app)/system/audit-events/_lib/parse-audit-list-search-params"
import type { AuditSearchParams } from "@/app/(app)/system/audit-events/_lib/parse-audit-list-search-params"

const exportQueryKeys = [
  "actor_account_id",
  "action",
  "target_type",
  "target_id",
  "outcome",
  "from",
  "to",
] as const
const exportQueryKeySet = new Set<string>(exportQueryKeys)
const maximumExportRangeMilliseconds = 31 * 24 * 60 * 60 * 1_000

export type AuditExportQueryResult =
  | { ok: true; request: AuditExportRequest }
  | { ok: false; field: "from" | "to" | "form"; message: string }

function normalizeExportInput(input: AuditSearchParams | URLSearchParams): AuditSearchParams {
  if (!(input instanceof URLSearchParams)) return input
  const normalized: AuditSearchParams = {}
  for (const key of new Set(input.keys())) {
    const values = input.getAll(key)
    normalized[key] = values.length === 1 ? values[0] : values
  }
  return normalized
}

/** Strictly validates the local CSV query and returns the typed API POST body. */
export function parseAuditExportSearchParams(
  source: AuditSearchParams | URLSearchParams,
): AuditExportQueryResult {
  const input = normalizeExportInput(source)
  for (const key of Object.keys(input)) {
    if (!exportQueryKeySet.has(key)) {
      return { ok: false, field: "form", message: "出力条件が無効です。" }
    }
  }

  const values = new Map<string, string>()
  for (const key of exportQueryKeys) {
    const rawValue = input[key]
    if (rawValue !== undefined && typeof rawValue !== "string") {
      return { ok: false, field: "form", message: "出力条件が無効です。" }
    }
    if (rawValue !== undefined && rawValue !== "") values.set(key, rawValue)
  }

  const actorAccountId = values.get("actor_account_id")
  if (actorAccountId !== undefined && !isOpaqueAccountId(actorAccountId)) {
    return { ok: false, field: "form", message: "実行アカウントIDが無効です。" }
  }

  const action = values.get("action")
  const targetType = values.get("target_type")
  const targetId = values.get("target_id")
  if (
    (action !== undefined && action.length > 200) ||
    (targetType !== undefined && targetType.length > 200) ||
    (targetId !== undefined && targetId.length > 512)
  ) {
    return { ok: false, field: "form", message: "出力条件が長すぎます。" }
  }

  const outcome = values.get("outcome")
  if (outcome !== undefined && !outcomes.has(outcome as AuditOutcome)) {
    return { ok: false, field: "form", message: "結果の指定が無効です。" }
  }

  const from = values.get("from")
  if (from === undefined) {
    return { ok: false, field: "from", message: "開始日時を入力してください。" }
  }
  const fromEpoch = exactSecondEpoch(from)
  if (fromEpoch === null) {
    return { ok: false, field: "from", message: "開始日時をオフセット付き形式で入力してください。" }
  }

  const to = values.get("to")
  if (to === undefined) {
    return { ok: false, field: "to", message: "終了日時を入力してください。" }
  }
  const toEpoch = exactSecondEpoch(to)
  if (toEpoch === null) {
    return { ok: false, field: "to", message: "終了日時をオフセット付き形式で入力してください。" }
  }
  if (fromEpoch >= toEpoch) {
    return { ok: false, field: "to", message: "終了日時は開始日時より後にしてください。" }
  }
  if (toEpoch - fromEpoch > maximumExportRangeMilliseconds) {
    return { ok: false, field: "to", message: "出力期間は31日以内にしてください。" }
  }

  const request: AuditExportRequest = { from, to }
  if (actorAccountId !== undefined) request.actor_account_id = actorAccountId
  if (action !== undefined) request.action = action
  if (targetType !== undefined) request.target_type = targetType
  if (targetId !== undefined) request.target_id = targetId
  if (outcome !== undefined) request.outcome = outcome as AuditOutcome
  return { ok: true, request }
}
