import { expect, test } from "bun:test"
import { ReviewSheetEntity } from "@/contexts/performance-review/domain/entities/review-sheet.entity"

const at = "2026-10-01T00:00:00.000Z"
const goal = { id: crypto.randomUUID(), title: "目標", success_criteria: "完了条件", weight: 100 }
function sheet() {
  return ReviewSheetEntity.create(
    {
      id: crypto.randomUUID(),
      cycle_id: crypto.randomUUID(),
      owner_account_id: crypto.randomUUID(),
      employee_id: crypto.randomUUID(),
      goals: [goal],
    },
    at,
  )
}
test("提出時の重みとIDの一意性を検査し、承認待ちと承認済みの目標を固定する", () => {
  expect(() =>
    sheet()
      .reviseGoals([{ ...goal, weight: 50 }], at)
      .submit("goals", at),
  ).toThrow("goal_weights_must_total_100")
  expect(() => sheet().reviseGoals([goal, goal], at)).toThrow("duplicate_goal")
  const pending = sheet().submit("goals", at)
  expect(() => pending.reviseGoals([goal], at)).toThrow("goals_locked")
  const approved = pending.decide("approved", at)
  expect(() => approved.reviseGoals([goal], at)).toThrow("goals_locked")
  expect(() => approved.submit("evaluation", at)).toThrow("assessments_must_cover_each_goal")
})
test("差戻し後だけ目標を訂正し、全目標の自己評価と上長評価を経て確定する", () => {
  const returned = sheet().submit("goals", at).decide("returned", at)
  const edited = returned.reviseGoals([{ ...goal, title: "修正した目標" }], at)
  const approved = edited.submit("goals", at).decide("approved", at)
  const assessments = [{ goal_id: goal.id, score: 4, comment: "根拠", actual: "実績" }]
  expect(() => approved.selfEvaluate([assessments[0]!, assessments[0]!], at)).toThrow()
  const pending = approved.selfEvaluate(assessments, at).submit("evaluation", at)
  expect(() => pending.selfEvaluate(assessments, at)).toThrow("self_assessment_locked")
  const done = pending.decide("approved", at)
  expect(done.data.status).toBe("finalized")
  expect(() => done.cancel(at)).toThrow("sheet_closed")
  expect(() => done.selfEvaluate(assessments, at)).toThrow()
})

test("評価の直接呼び出しでも範囲外の点数と空の根拠を拒否する", () => {
  const review = sheet()
  for (const score of [0, 6, 1.5, Number.NaN])
    expect(() =>
      review.validateAssessments([{ goal_id: goal.id, score, comment: "根拠" }]),
    ).toThrow("invalid_assessment")
  expect(() => review.validateAssessments([{ goal_id: goal.id, score: 4, comment: "  " }])).toThrow(
    "invalid_assessment",
  )
  expect(() =>
    review.validateAssessments([{ goal_id: goal.id, score: 4, comment: "根拠" }]),
  ).not.toThrow()
})
