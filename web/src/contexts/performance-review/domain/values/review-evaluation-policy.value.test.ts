import { expect, test } from "bun:test"
import { ReviewEvaluationPolicyValue } from "@/contexts/performance-review/domain/values/review-evaluation-policy.value"

const declaration = {
  version: 1,
  scale: [
    { value: 1, label: "改善" },
    { value: 3, label: "標準" },
    { value: 7, label: "期待超過" },
  ],
  sections: [
    { key: "mbo", name: "目標", weight: 70 },
    { key: "behavior", name: "行動", weight: 30 },
  ],
}
const goals = [
  { id: "first", section_key: "mbo", weight: 100 },
  { id: "second", section_key: "behavior", weight: 100 },
]

test("期間ごとの区分配分と尺度で集計し、入力と値を変更不能に保つ", () => {
  const policy = ReviewEvaluationPolicyValue.create(declaration)
  const summary = policy.summarize(goals, [
    { goal_id: "first", score: 7 },
    { goal_id: "second", score: 3 },
  ])
  expect(summary).toMatchObject({ weighted_score: 5.8, normalized_score: 80 })
  expect(Object.isFrozen(policy.data.sections[0])).toBe(true)
  expect(Object.isFrozen(policy.data.scale)).toBe(true)
  expect(declaration.sections[0]!.weight).toBe(70)
  expect(() => policy.validateScore(5)).toThrow("invalid_assessment")
})

test("配分の不足・区分の重複・逆順や重複した尺度を拒否する", () => {
  expect(() =>
    ReviewEvaluationPolicyValue.create({
      ...declaration,
      sections: [{ key: "mbo", name: "目標", weight: 70 }],
    }),
  ).toThrow("invalid_evaluation_policy")
  expect(() =>
    ReviewEvaluationPolicyValue.create({
      ...declaration,
      sections: [
        { key: "mbo", name: "目標", weight: 50 },
        { key: "mbo", name: "重複", weight: 50 },
      ],
    }),
  ).toThrow("invalid_evaluation_policy")
  expect(() =>
    ReviewEvaluationPolicyValue.create({ ...declaration, scale: [...declaration.scale].reverse() }),
  ).toThrow("invalid_evaluation_policy")
  expect(() =>
    ReviewEvaluationPolicyValue.create({
      ...declaration,
      scale: [declaration.scale[0], declaration.scale[0]],
    }),
  ).toThrow("invalid_evaluation_policy")
})

test("提出では区分ごとの重み100と全区分の目標・評価を要求する", () => {
  const policy = ReviewEvaluationPolicyValue.create(declaration)
  expect(() => policy.validateGoals([goals[0]!], true)).toThrow("goal_weights_must_total_100")
  expect(() => policy.validateGoals([{ ...goals[0]!, section_key: "unknown" }], false)).toThrow(
    "unknown_evaluation_section",
  )
  expect(() => policy.validateGoals([{ ...goals[0]!, weight: 1.5 }], false)).toThrow(
    "invalid_goal_weights",
  )
  expect(() => policy.validateGoals([goals[0]!, goals[0]!], false)).toThrow("duplicate_goal")
  expect(() => policy.summarize(goals, [{ goal_id: "first", score: 7 }])).toThrow(
    "assessments_must_cover_each_goal",
  )
  expect(() =>
    policy.summarize(goals, [
      { goal_id: "first", score: 7 },
      { goal_id: "foreign", score: 3 },
    ]),
  ).toThrow("assessments_must_cover_each_goal")
  expect(() =>
    policy.summarize(goals, [
      { goal_id: "first", score: 7 },
      { goal_id: "second", score: 5 },
    ]),
  ).toThrow("invalid_assessment")
})
