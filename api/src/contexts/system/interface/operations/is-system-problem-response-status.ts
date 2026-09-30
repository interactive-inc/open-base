import type { SystemProblemStatus } from "@system/interface/problem-details/lib/get-system-problem-title"
import { isSystemProblemStatus } from "@system/interface/problem-details/lib/is-system-problem-status"

/** SystemのHTTP応答contractを組み立て・検証する。 */
export function isSystemProblemResponseStatus(
  input: Parameters<typeof isSystemProblemStatus>[0],
): input is SystemProblemStatus {
  return isSystemProblemStatus(input)
}
