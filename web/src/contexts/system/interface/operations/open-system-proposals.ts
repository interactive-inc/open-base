import { SystemD1ProposalAdapter } from "@system/infrastructure/adapters/workflow/system-d1-proposal.adapter"

/** Systemの提案・判断正本を読むquery口を開く。業務意味やCompany表示は組み立てない。 */
export function openSystemProposals(
  context: ConstructorParameters<typeof SystemD1ProposalAdapter>[0],
): SystemD1ProposalAdapter {
  return new SystemD1ProposalAdapter(context)
}
