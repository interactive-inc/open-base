import type { HTTPErrorBody } from "@system/interface/errors"
import { isHTTPErrorBody } from "@system/interface/http-error-body/lib/is-http-error-body"

/** SystemのHTTP応答contractを組み立て・検証する。 */
export function isSystemHttpErrorBody(
  input: Parameters<typeof isHTTPErrorBody>[0],
): input is HTTPErrorBody {
  return isHTTPErrorBody(input)
}
