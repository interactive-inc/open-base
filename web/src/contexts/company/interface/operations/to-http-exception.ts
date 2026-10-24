import {
  CompanyConflictError,
  CompanyForbiddenError,
  CompanyNotFoundError,
  CompanyOperationError,
  CompanyValidationError,
} from "@/contexts/company/domain/errors"
import {
  CompanyApplicationConflictError,
  CompanyApplicationForbiddenError,
  CompanyApplicationNotFoundError,
  CompanyApplicationUnavailableError,
  CompanyApplicationValidationError,
  type CompanyHTTPException,
} from "@/contexts/company/interface/errors"

/** Company Applicationの意味的な失敗をHTTP境界の失敗へ変換する。 */
export function toHttpException(error: CompanyOperationError): CompanyHTTPException {
  if (error instanceof CompanyForbiddenError) {
    return new CompanyApplicationForbiddenError(error.code, error.message)
  }
  if (error instanceof CompanyNotFoundError) {
    return new CompanyApplicationNotFoundError(error.code, error.message)
  }
  if (error instanceof CompanyConflictError) {
    return new CompanyApplicationConflictError(error.code, error.message)
  }
  if (error instanceof CompanyValidationError) {
    return new CompanyApplicationValidationError(error.code, error.message)
  }
  return new CompanyApplicationUnavailableError(error.code, error.message, error)
}
