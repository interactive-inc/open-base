import type { AuditListQuery, AuditOutcome } from "@/lib/api/types/audit-types"
import { exactSecondEpoch } from "@/app/(app)/system/audit-events/_lib/exact-second-epoch"
import { isOpaqueAccountId } from "@/app/(app)/system/audit-events/_lib/is-opaque-account-id"

export type AuditSearchParams = Record<string, string | ReadonlyArray<string> | undefined>

export type AuditListQueryResult = { ok: true; query: AuditListQuery } | { ok: false }

export const queryKeys = [
  "actor_account_id",
  "action",
  "target_type",
  "target_id",
  "outcome",
  "from",
  "to",
  "limit",
  "cursor",
] as const

export const outcomes = new Set<AuditOutcome>(["succeeded", "denied", "failed"])

const queryKeySet = new Set<string>(queryKeys)
const webLimitPattern = /^(?:[1-9]|[1-4][0-9]|50)$/u

/** Strictly parses the Next.js URL state without collapsing repeated values. */
export function parseAuditListSearchParams(input: AuditSearchParams): AuditListQueryResult {
  for (const key of Object.keys(input)) {
    if (!queryKeySet.has(key)) return { ok: false }
  }

  const values = new Map<string, string>()
  for (const key of queryKeys) {
    const rawValue = input[key]
    if (rawValue !== undefined && typeof rawValue !== "string") return { ok: false }
    if (rawValue !== undefined && rawValue !== "") values.set(key, rawValue)
  }

  const actorAccountId = values.get("actor_account_id")
  if (actorAccountId !== undefined && !isOpaqueAccountId(actorAccountId)) {
    return { ok: false }
  }

  const action = values.get("action")
  if (action !== undefined && action.length > 200) return { ok: false }
  const targetType = values.get("target_type")
  if (targetType !== undefined && targetType.length > 200) return { ok: false }
  const targetId = values.get("target_id")
  if (targetId !== undefined && targetId.length > 512) return { ok: false }

  const outcome = values.get("outcome")
  if (outcome !== undefined && !outcomes.has(outcome as AuditOutcome)) return { ok: false }

  const from = values.get("from")
  const to = values.get("to")
  const fromEpoch = from === undefined ? undefined : exactSecondEpoch(from)
  const toEpoch = to === undefined ? undefined : exactSecondEpoch(to)
  if (fromEpoch === null || toEpoch === null) return { ok: false }
  if (fromEpoch !== undefined && toEpoch !== undefined && fromEpoch >= toEpoch) {
    return { ok: false }
  }

  const limit = values.get("limit") ?? "50"
  if (!webLimitPattern.test(limit)) return { ok: false }
  const cursor = values.get("cursor")
  if (cursor !== undefined && cursor.length > 256) return { ok: false }

  const query: AuditListQuery = { limit }
  if (actorAccountId !== undefined) query.actor_account_id = actorAccountId
  if (action !== undefined) query.action = action
  if (targetType !== undefined) query.target_type = targetType
  if (targetId !== undefined) query.target_id = targetId
  if (outcome !== undefined) query.outcome = outcome as AuditOutcome
  if (from !== undefined) query.from = from
  if (to !== undefined) query.to = to
  if (cursor !== undefined) query.cursor = cursor

  return { ok: true, query }
}
