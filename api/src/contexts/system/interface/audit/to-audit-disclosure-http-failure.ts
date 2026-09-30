import { SystemAuditDisclosureError } from "@system/domain/errors"
import { SystemHumanOperationAuthorizationAdapter } from "@system/infrastructure/adapters/iam/system-human-operation-authorization.adapter"
import type { SystemHTTPExceptionProps } from "@system/interface/errors"

/** 開示設定の検証・版競合・資格失効をHTTPの失敗へ変換する。 */
export function toAuditDisclosureHttpFailure(cause: Error | "forbidden"): SystemHTTPExceptionProps {
  if (
    cause === "forbidden" ||
    SystemHumanOperationAuthorizationAdapter.rejected(cause) ||
    (cause instanceof SystemAuditDisclosureError && cause.kind === "forbidden")
  )
    return { status: 403, code: "forbidden", detail: "開示設定を操作する権限がありません", cause }
  if (cause instanceof SystemAuditDisclosureError && cause.kind === "invalid")
    return { status: 400, code: "audit_disclosure_invalid", detail: "開示設定が不正です", cause }
  if (cause instanceof SystemAuditDisclosureError && cause.kind === "conflict")
    return {
      status: 409,
      code: "audit_disclosure_conflict",
      detail: "開示設定の版または再送内容が一致しません",
      cause,
    }
  return {
    status: 503,
    code: "audit_disclosure_unavailable",
    detail: "開示設定を確認できません",
    cause,
  }
}
