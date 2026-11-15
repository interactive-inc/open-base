import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, within } from "storybook/test"
import ReviewCycles from "@/pages/reviews/cycles/index"

const meta = {
  title: "Pages/Reviews/Cycles",
  component: ReviewCycles,
  parameters: { layout: "fullscreen" },
  args: { email: "you@example.com", pathname: "/reviews" },
} satisfies Meta<typeof ReviewCycles>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText("2026年度 下期")).toBeVisible()
    await expect(canvas.getByText("2026年10月1日 〜 2027年3月31日")).toBeVisible()
    await expect(canvas.queryByRole("link", { name: "評価期間を作る" })).toBeNull()
  },
}
export const Empty: Story = {
  parameters: { mockScenario: "empty" },
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByText("まだ評価期間がありません")).toBeVisible()
  },
}
export const Error: Story = { parameters: { mockScenario: "error" } }
export const Loading: Story = { parameters: { mockScenario: "slow" } }
export const Mobile: Story = { globals: { viewport: { value: "mobile1", isRotated: false } } }
