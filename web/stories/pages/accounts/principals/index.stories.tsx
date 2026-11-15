import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, within } from "storybook/test"
import Principals from "@/pages/accounts/principals/index"

const meta = {
  title: "Pages/Accounts/Principals/List",
  component: Principals,
  parameters: { layout: "fullscreen" },
  args: { email: "you@example.com", pathname: "/accounts" },
} satisfies Meta<typeof Principals>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText("Example Agent")).toBeVisible()
    await expect(canvas.getByText("エージェント")).toBeVisible()
  },
}
export const Empty: Story = { parameters: { mockScenario: "empty" } }
export const Forbidden: Story = { parameters: { mockScenario: "member" } }
export const Error: Story = { parameters: { mockScenario: "error" } }
export const Loading: Story = { parameters: { mockScenario: "slow" } }
export const Mobile: Story = { globals: { viewport: { value: "mobile1", isRotated: false } } }
