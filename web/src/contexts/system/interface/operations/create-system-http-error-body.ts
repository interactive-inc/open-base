import { createHTTPErrorBody } from "@system/interface/http-error-body/lib/create-http-error-body"

/** SystemのHTTP応答contractを組み立て・検証する。 */
export function createSystemHttpErrorBody(...input: Parameters<typeof createHTTPErrorBody>) {
  return createHTTPErrorBody(...input)
}
