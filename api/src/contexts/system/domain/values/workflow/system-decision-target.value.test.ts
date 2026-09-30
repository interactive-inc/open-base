import { describe, expect, test } from "bun:test"
import { SystemDecisionTargetValue } from "@system/domain/values/workflow/system-decision-target.value"

const input = {
  proposalVersion: 1,
  proposalDigest: "a".repeat(64),
  taskKey: "review",
  taskRound: 1,
}

describe("閲覧した判断対象", () => {
  test("提案と段階が全て同じ場合だけ一致する", () => {
    const target = SystemDecisionTargetValue.create(input)
    if (target instanceof Error) throw target
    const same = SystemDecisionTargetValue.create({ ...input })
    if (same instanceof Error) throw same
    expect(target.equals(same)).toBe(true)
    for (const change of [
      { proposalVersion: 2 },
      { proposalDigest: "b".repeat(64) },
      { taskKey: "final" },
      { taskRound: 2 },
    ]) {
      const current = SystemDecisionTargetValue.create({ ...input, ...change })
      if (current instanceof Error) throw current
      expect(target.equals(current)).toBe(false)
    }
  })

  test("欠落・不正なhash・安全に比較できない版を拒否する", () => {
    for (const invalid of [
      null,
      {},
      { ...input, proposalDigest: "invalid" },
      { ...input, proposalVersion: 0 },
      { ...input, taskRound: Number.MAX_SAFE_INTEGER + 1 },
      { ...input, taskKey: "" },
    ]) {
      expect(SystemDecisionTargetValue.create(invalid)).toBeInstanceOf(Error)
    }
  })
})
