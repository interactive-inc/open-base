import { createSystemProblemDetails } from "@system/interface/problem-details/lib/create-system-problem-details"

/** SystemのHTTP応答contractを組み立て・検証する。 */
export function describeSystemProblem(...input: Parameters<typeof createSystemProblemDetails>) {
  return createSystemProblemDetails(...input)
}
