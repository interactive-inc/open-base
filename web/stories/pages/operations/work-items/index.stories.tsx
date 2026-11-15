import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, within } from "storybook/test"
import WorkItems from "@/pages/operations/work-items/index"

const meta = {
  title: "Pages/Operations/WorkItems/List",
  component: WorkItems,
  parameters: { layout: "fullscreen" },
  args: { email: "you@example.com", pathname: "/operations" },
} satisfies Meta<typeof WorkItems>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText("Example 月次の権限の棚卸し")).toBeVisible()
    await expect(canvas.getByText(/手当てが要る作業が 3 件あります/)).toBeVisible()
    await expect(canvas.getByText("引き継ぎ待ち")).toBeVisible()
    await expect(canvas.queryByRole("link", { name: "作業を依頼する" })).toBeNull()
  },
}
export const Empty: Story = {
  parameters: { mockScenario: "empty" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText("まだ作業がありません")).toBeVisible()
  },
}
export const Error: Story = { parameters: { mockScenario: "error" } }
export const Loading: Story = { parameters: { mockScenario: "slow" } }
export const Mobile: Story = { globals: { viewport: { value: "mobile1", isRotated: false } } }
