import { toNegotiatedProblemResponse } from "@system/interface/problem-details/lib/to-negotiated-problem-response"

/** SystemのHTTP応答contractを組み立て・検証する。 */
export function negotiateSystemProblemResponse(
  ...input: Parameters<typeof toNegotiatedProblemResponse>
) {
  return toNegotiatedProblemResponse(...input)
}
