import { toHttpException } from "@/lib/http/to-http-exception"
import {
  ApplicationError,
  PayloadTooLargeError,
  UnavailableError,
  ValidationError,
} from "@/lib/errors"
import {
  CompanyOperationError,
  CompanyPayloadTooLargeError,
  CompanyUnavailableError,
  CompanyValidationError,
} from "@/contexts/company/domain/errors"
import { auditUnavailable } from "@/api/http/audit/audit-unavailable"

/**
 * Company の監査台帳が返す失敗を、監査 route の応答契約（error と code の JSON）を保つ失敗へ写す。
 * Company の HTTP 変換は problem+json を返すため、既存の契約を持つこの route では使わない。
 */
function toAuditApplicationError(error: CompanyOperationError): ApplicationError {
  if (error instanceof CompanyValidationError) {
    return new ValidationError(error.message, error.code, { cause: error })
  }
  if (error instanceof CompanyPayloadTooLargeError) {
    return new PayloadTooLargeError(error.message, error.code, { cause: error })
  }
  if (error instanceof CompanyUnavailableError) {
    return new UnavailableError(error.message, error.code, { cause: error })
  }
  return auditUnavailable(error)
}

/** Converts all route-boundary application errors while hiding non-application causes. */
export function throwAuditRouteError(error: unknown): never {
  if (error instanceof ApplicationError) throw toHttpException(error)
  if (error instanceof CompanyOperationError) throw toHttpException(toAuditApplicationError(error))
  throw toHttpException(auditUnavailable(error))
}
