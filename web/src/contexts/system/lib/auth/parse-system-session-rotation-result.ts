import type { SessionRotationAuditEvents } from "@system/domain/definitions/auth/session-rotation-audit-events.definition"
import type { RefreshTokenRotationDecision } from "@system/domain/definitions/auth/refresh-token-rotation-decision.definition"

/** D1 RETURNINGのevent IDをclosedなrotation decisionへ変換する。 */
export function parseSystemSessionRotationResult(
  databaseResult: D1Result<unknown> | undefined,
  audits: SessionRotationAuditEvents,
): RefreshTokenRotationDecision | Error {
  const rows = databaseResult?.results

  if (!Array.isArray(rows) || rows.length !== 1) {
    return new Error("System Session rotation decision result is invalid")
  }

  const row = rows[0]

  if (typeof row !== "object" || row === null || Array.isArray(row) || !("event_id" in row)) {
    return new Error("System Session rotation decision row is invalid")
  }
  if (row.event_id === audits.rotated.eventId) return "rotated"
  if (row.event_id === audits.reused.eventId) return "reused"
  if (row.event_id === audits.invalid.eventId) return "invalid"

  return new Error("System Session rotation decision value is invalid")
}
