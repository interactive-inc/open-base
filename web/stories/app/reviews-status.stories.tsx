import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, within } from "storybook/test"
import { createMockState } from "@open-base/mock/seed"
import { latestReturn } from "@/components/app/reviews-model"
import {
  ReviewSheetCards,
  ReviewStatusLabel,
  ReviewTurnPanel,
} from "@/components/app/reviews-status"
import type { ReviewHistoryEntry, ReviewSheet, ReviewStatus } from "@/components/app/reviews-types"

const reviews = createMockState("admin").areas.reviews as {
  sheets: { data: ReviewSheet }[]
  history: Record<string, ReviewHistoryEntry[]>
}
/** seedで作った順のシート。1が自分の今期、4と5が判断待ち、6が差し戻し。 */
const sheet = (n: number) => reviews.sheets[n - 1]!.data

const STATUSES: ReadonlyArray<ReviewStatus> = [
  "draft",
  "goals_pending",
  "goals_returned",
  "goals_rejected",
  "goals_approved",
  "evaluation_pending",
  "evaluation_returned",
  "evaluation_rejected",
  "finalized",
  "cancelled",
]

const meta = {
  title: "App/Reviews/Status",
  component: ReviewTurnPanel,
  args: { sheet: sheet(1), viewer: "owner", returned: null },
  decorators: [
    (Story) => (
      <main className="flex w-[40rem] max-w-full flex-col gap-4">
        <h1 className="sr-only">評価シート</h1>
        {Story()}
      </main>
    ),
  ],
} satisfies Meta<typeof ReviewTurnPanel>
export default meta
type Story = StoryObj<typeof meta>

export const OwnerTurn: Story = {}
export const WaitingForEvaluator: Story = { args: { sheet: sheet(4), viewer: "other" } }
export const EvaluatorTurn: Story = { args: { sheet: sheet(5), viewer: "evaluator" } }
export const Returned: Story = {
  args: {
    sheet: sheet(6),
    viewer: "owner",
    returned: latestReturn(reviews.history[sheet(6).id] ?? []),
  },
}
export const Finalized: Story = { args: { sheet: sheet(2) } }
export const Labels: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      {STATUSES.map((status) => (
        <ReviewStatusLabel key={status} status={status} />
      ))}
    </div>
  ),
}
export const Cards: Story = {
  // カードの見出しはh3なので、画面と同じく一覧の見出し（h2）の下に置く。
  render: () => (
    <section className="flex flex-col gap-4">
      <h2 className="text-base font-medium">評価シート</h2>
      <ReviewSheetCards
        sheets={[
          { sheet: sheet(4), viewer: "evaluator" },
          { sheet: sheet(1), viewer: "owner" },
          { sheet: sheet(7), viewer: "other" },
        ]}
      />
    </section>
  ),
  play: async ({ canvasElement }) => {
    // 一件ごとのカードの見出しが、そのシートへのリンクになる。
    await expect(
      within(canvasElement).getByRole("link", { name: "あなたの評価シート" }),
    ).toHaveAttribute("href", `/reviews/sheets/${sheet(1).id}`)
  },
}
export const Dark: Story = {
  args: { sheet: sheet(5), viewer: "evaluator" },
  globals: { theme: "dark", backgrounds: { value: "dark" } },
}
