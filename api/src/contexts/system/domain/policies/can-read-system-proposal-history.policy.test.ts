import { canReadSystemProposalHistory } from "@system/domain/policies/can-read-system-proposal-history.policy"
import { expect, test } from "bun:test"

test("履歴開示は閲覧権限を必須とし、申請者・判断者・代理元か明示した全件閲覧に限る", () => {
  const evaluate = (accountId: string, permissions: ReadonlyArray<string>) =>
    canReadSystemProposalHistory({
      permissionKeys: new Set(permissions),
      accountId,
      createdByAccountId: "owner",
      attestations: [{ actorAccountId: "delegate", representedAccountId: "reviewer" }],
    })
  for (const accountId of ["owner", "delegate", "reviewer"]) {
    expect(evaluate(accountId, ["system:procedure:read"])).toBe(true)
    expect(evaluate(accountId, [])).toBe(false)
  }
  expect(evaluate("stranger", ["system:procedure:read"])).toBe(false)
  expect(evaluate("stranger", ["system:admin"])).toBe(false)
  expect(evaluate("stranger", ["system:admin", "system:procedure:read"])).toBe(false)
  expect(evaluate("stranger", ["system:procedure:read:all"])).toBe(false)
  expect(evaluate("stranger", ["system:procedure:read", "system:procedure:read:all"])).toBe(true)
})
