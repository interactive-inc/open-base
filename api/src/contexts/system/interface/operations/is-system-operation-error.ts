import type { SystemOperationError } from "@system/interface/operations/errors"
import { ApplicationError } from "@system/application/errors"

export function isSystemOperationError(error: unknown): error is SystemOperationError {
  return error instanceof ApplicationError
}
