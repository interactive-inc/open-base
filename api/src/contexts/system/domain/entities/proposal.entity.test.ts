import { testLiteralId } from "@/contexts/system/test/system-test-id.test-support"
import { describe, expect, test } from "bun:test"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { InvalidSystemProposalError } from "@system/domain/errors"
import { ProposalEntity } from "@system/domain/entities/proposal.entity"
import { proposalIdSchema } from "@system/domain/schemas/workflow/proposal-id.schema"

const accountId = zAccountId.parse("d5858208-e680-4db8-a05d-8bf4f900c24e")

describe("ProposalEntity", () => {
  test("同じJSON意味を同じcanonical bodyとSHA-256 digestへ固定する", async () => {
    const left = await ProposalEntity.create({
      id: proposalIdSchema.parse(testLiteralId("proposal-1")),
      seriesId: testLiteralId("series-1"),
      version: 1,
      procedureKey: "change",
      procedureRevision: 3,
      body: { z: 2, a: { y: true, x: null } },
      createdByAccountId: accountId,
      supersedesProposalId: null,
      createdAt: new Date(100),
    })
    const right = await ProposalEntity.create({
      id: proposalIdSchema.parse(testLiteralId("proposal-2")),
      seriesId: testLiteralId("series-2"),
      version: 1,
      procedureKey: "change",
      procedureRevision: 3,
      body: { a: { x: null, y: true }, z: 2 },
      createdByAccountId: accountId,
      supersedesProposalId: null,
      createdAt: new Date(100),
    })

    expect(left).toBeInstanceOf(ProposalEntity)
    expect(right).toBeInstanceOf(ProposalEntity)
    if (!(left instanceof ProposalEntity) || !(right instanceof ProposalEntity)) return
    expect(left.bodyJson).toBe('{"a":{"x":null,"y":true},"z":2}')
    expect(left.digest).toBe(right.digest)
    expect(left.digest).toMatch(/^[0-9a-f]{64}$/)
  })

  test("restore時にbody差替えとdigest不一致を拒否する", async () => {
    const result = await ProposalEntity.restore({
      id: testLiteralId("proposal-1"),
      seriesId: testLiteralId("series-1"),
      version: 1,
      procedureKey: "change",
      procedureRevision: 1,
      bodyJson: '{"safe":true}',
      digest: "a".repeat(64),
      createdByAccountId: accountId,
      supersedesProposalId: null,
      createdAt: new Date(100),
    })

    expect(result).toBeInstanceOf(InvalidSystemProposalError)
    if (result instanceof InvalidSystemProposalError) expect(result.code).toBe("digest_mismatch")
  })

  test("版とsupersedesのshapeを検査する", async () => {
    const result = await ProposalEntity.create({
      id: proposalIdSchema.parse(testLiteralId("proposal-1")),
      seriesId: testLiteralId("series-1"),
      version: 0,
      procedureKey: "change",
      procedureRevision: 1,
      body: {},
      createdByAccountId: accountId,
      supersedesProposalId: "",
      createdAt: new Date(100),
    })

    expect(result).toBeInstanceOf(InvalidSystemProposalError)
  })
})
