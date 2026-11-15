import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, within } from "storybook/test"
import { createMockState } from "@open-base/mock/seed"
import { ReviewGoalList } from "@/components/app/reviews-goal-list"
import { evaluatorReview } from "@/components/app/reviews-model"
import type {
  ReviewHistoryEntry,
  ReviewSheet,
  ReviewSheetDetail,
} from "@/components/app/reviews-types"

const reviews = createMockState("admin").areas.reviews as {
  sheets: { data: ReviewSheet }[]
  history: Record<string, ReviewHistoryEntry[]>
}
const detail = (n: number): ReviewSheetDetail => ({
  ...reviews.sheets[n - 1]!.data,
  decision_target: null,
  self_evaluation_summary:
    n === 2 ? { weighted_score: 3.6, normalized_score: 65, sections: [] } : null,
})
const history = (n: number) => reviews.history[reviews.sheets[n - 1]!.data.id] ?? []

const meta = {
  title: "App/Reviews/GoalList",
  component: ReviewGoalList,
  args: { sheet: detail(2), evaluator: evaluatorReview(history(2)) },
  decorators: [
    (Story) => (
      <main className="w-[48rem] max-w-full">
        <h1 className="sr-only">評価シート</h1>
        {Story()}
      </main>
    ),
  ],
} satisfies Meta<typeof ReviewGoalList>
export default meta
type Story = StoryObj<typeof meta>

export const Finalized: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText("自己評価の合計")).toBeVisible()
    await expect(canvas.getByText("評価者の評価の合計")).toBeVisible()
  },
}
export const SelfAssessedOnly: Story = { args: { sheet: detail(5), evaluator: null } }
export const NotStarted: Story = { args: { sheet: detail(1), evaluator: null } }
export const NoGoals: Story = { args: { sheet: detail(8), evaluator: null } }
export const Mobile: Story = { globals: { viewport: { value: "mobile1", isRotated: false } } }
