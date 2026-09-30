import { ProposalDigestValue } from "@system/domain/values/workflow/proposal-digest.value"

/** Systemが所有する値を検証・生成する。 */
export function createSystemProposalDigest(
  ...input: Parameters<typeof ProposalDigestValue.create>
) {
  return ProposalDigestValue.create(...input)
}
