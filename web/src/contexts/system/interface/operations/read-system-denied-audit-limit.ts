import {
  DENIED_AUDIT_WINDOW_MILLISECONDS,
  DENIED_AUDIT_LIMIT_PER_WINDOW,
} from "@system/domain/definitions/audit/denied-audit-limit.definition"

/** 共通の拒否記録と自己監査が同じ件数上限を使うための公開契約。 */
export function readSystemDeniedAuditLimit() {
  return Object.freeze({
    windowMilliseconds: DENIED_AUDIT_WINDOW_MILLISECONDS,
    limitPerWindow: DENIED_AUDIT_LIMIT_PER_WINDOW,
  })
}
