import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, within } from "storybook/test"
import { createMockState } from "@open-base/mock/seed"
import { ReviewHistory } from "@/components/app/reviews-history"
import type { ReviewHistoryEntry, ReviewSheet } from "@/components/app/reviews-types"

const reviews = createMockState("admin").areas.reviews as {
  sheets: { data: ReviewSheet }[]
  history: Record<string, ReviewHistoryEntry[]>
}
const finalized = reviews.sheets[1]!.data

const meta = {
  title: "App/Reviews/History",
  component: ReviewHistory,
  args: {
    entries: reviews.history[finalized.id] ?? [],
    ownerAccountId: finalized.owner_account_id,
    truncated: false,
  },
  decorators: [
    (Story) => (
      <main className="w-[40rem] max-w-full">
        <h1 className="sr-only">評価シート</h1>
        {Story()}
      </main>
    ),
  ],
} satisfies Meta<typeof ReviewHistory>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText("版 1")).toBeVisible()
    await expect(canvas.getByText("評価を確定します")).toBeVisible()
  },
}
export const Empty: Story = { args: { entries: [] } }
export const Truncated: Story = { args: { truncated: true } }
