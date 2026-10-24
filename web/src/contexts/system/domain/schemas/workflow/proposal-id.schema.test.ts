import {
  createProposalId,
  proposalIdSchema,
} from "@system/domain/schemas/workflow/proposal-id.schema"
import { describe, expect, test } from "bun:test"

describe("ProposalId", () => {
  test("新規IDをUUIDとして生成し、ProposalIdへbrandする", () => {
    const proposalId = createProposalId()

    expect(proposalIdSchema.safeParse(proposalId).success).toBe(true)
    expect(proposalId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    )
  })
})
