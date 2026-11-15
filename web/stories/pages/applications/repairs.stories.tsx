import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, within } from "storybook/test"
import WorkflowRepairs from "@/pages/applications/repairs"

const meta = {
  title: "Pages/Applications/Repairs",
  component: WorkflowRepairs,
  parameters: { layout: "fullscreen" },
  args: { email: "you@example.com", pathname: "/applications" },
} satisfies Meta<typeof WorkflowRepairs>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText("承認できる人が足りません")).toBeVisible()
    await expect(canvas.queryByRole("button", { name: "担当を付け替える" })).toBeNull()
  },
}
export const Forbidden: Story = { parameters: { mockScenario: "member" } }
export const Empty: Story = { parameters: { mockScenario: "empty" } }
export const Error: Story = { parameters: { mockScenario: "error" } }
export const Loading: Story = { parameters: { mockScenario: "slow" } }
export const Mobile: Story = { globals: { viewport: { value: "mobile1", isRotated: false } } }
