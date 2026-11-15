import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, within } from "storybook/test"
import { RevisionHistory } from "@/components/app/business-history"

const meta = {
  title: "App/BusinessHistory",
  component: RevisionHistory,
  args: {
    entries: [
      {
        revision: 1,
        recorded_at: "2026-09-20T01:00:00.000Z",
        reason: "受注の見込み",
        summary: "予定 · 生産管理の見直し",
      },
      {
        revision: 2,
        recorded_at: "2026-10-01T01:00:00.000Z",
        reason: "作業の開始",
        summary: "進行中 · 生産管理の見直し",
      },
    ],
  },
  decorators: [(Story) => <div className="w-96">{Story()}</div>],
} satisfies Meta<typeof RevisionHistory>
export default meta
type Story = StoryObj<typeof meta>

export const NewestFirst: Story = {
  play: async ({ canvasElement }) => {
    const items = within(canvasElement).getAllByRole("listitem")
    await expect(items[0]).toHaveTextContent("第2版")
  },
}
export const Empty: Story = { args: { entries: [] } }
