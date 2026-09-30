import { OIDCHTTPException } from "@system/interface/errors"

export function isSystemOidcHttpError(error: unknown): error is OIDCHTTPException {
  return error instanceof OIDCHTTPException
}
