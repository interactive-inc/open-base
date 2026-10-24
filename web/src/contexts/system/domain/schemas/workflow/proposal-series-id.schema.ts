import {
  proposalSeriesIdSchema,
  type ProposalSeriesId,
} from "@system/domain/schemas/workflow/proposal-id.schema"
import type { ProposalDigest } from "@system/domain/schemas/workflow/system-case-reference.schema"

/**
 * 同じ要求の再送が同じ提案系列を指すよう、要求の digest から決まる UUID（RFC 9562 の version 8）を作る。
 * digest の先頭 122 bit を使い、version と variant の bit だけを固定する。
 */
export function createProposalSeriesIdFromDigest(digest: ProposalDigest): ProposalSeriesId {
  const hex = digest.slice(0, 32)
  const variant = ((Number.parseInt(hex.charAt(16), 16) & 0x3) | 0x8).toString(16)
  return proposalSeriesIdSchema.parse(
    `${hex.slice(0, 8)}-${hex.slice(8, 12)}-8${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`,
  )
}
