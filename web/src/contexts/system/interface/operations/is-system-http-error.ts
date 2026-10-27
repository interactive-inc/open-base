import { SystemHTTPException } from "@system/interface/errors"

export function isSystemHttpError(error: unknown): error is SystemHTTPException {
  return error instanceof SystemHTTPException
}
