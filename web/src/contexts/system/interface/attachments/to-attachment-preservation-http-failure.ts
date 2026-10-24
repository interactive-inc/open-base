import { SystemAttachmentError } from "@system/domain/errors"
import { SystemHumanOperationAuthorizationAdapter } from "@system/infrastructure/adapters/iam/system-human-operation-authorization.adapter"
import type { SystemHTTPExceptionProps } from "@system/interface/errors"

/** 保全の入力・競合・現在の資格の失敗を公開APIの結果へ変換する。 */
export function toAttachmentPreservationHttpFailure(
  cause: Error | "forbidden" | "conflict" | "not_found",
): SystemHTTPExceptionProps {
  if (cause === "forbidden" || SystemHumanOperationAuthorizationAdapter.rejected(cause))
    return {
      status: 403,
      code: "forbidden",
      detail: "保全を操作する権限がありません",
      cause,
    }
  if (cause === "conflict")
    return {
      status: 409,
      code: "preservation_conflict",
      detail: "保全の内容または対象の状態が変わっています",
    }
  if (cause === "not_found")
    return {
      status: 404,
      code: "preservation_not_found",
      detail: "保全が見つかりません",
    }
  if (cause instanceof SystemAttachmentError && cause.kind === "validation")
    return { status: 400, code: cause.code, detail: cause.message, cause }
  return {
    status: 503,
    code: "preservation_unavailable",
    detail: "保全の処理を完了できません",
    cause,
  }
}
