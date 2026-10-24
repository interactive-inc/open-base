import { createProposalSeriesIdFromDigest } from "@system/domain/schemas/workflow/proposal-series-id.schema"
import { proposalDigestSchema } from "@system/domain/schemas/workflow/system-case-reference.schema"
import { describe, expect, test } from "bun:test"

describe("ProposalSeriesId", () => {
  test("同じdigestから同じUUIDを作り、digestが違えば別のUUIDになる", () => {
    const digest = proposalDigestSchema.parse("f".repeat(64))
    const other = proposalDigestSchema.parse("0123456789abcdef".repeat(4))

    expect(String(createProposalSeriesIdFromDigest(digest))).toBe(
      "ffffffff-ffff-8fff-bfff-ffffffffffff",
    )
    expect(String(createProposalSeriesIdFromDigest(other))).toBe(
      "01234567-89ab-8def-8123-456789abcdef",
    )
    expect(createProposalSeriesIdFromDigest(digest)).toBe(createProposalSeriesIdFromDigest(digest))
  })
})
