import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, within } from "storybook/test"
import ApplicationTemplates from "@/pages/applications/templates/index"

const meta = {
  title: "Pages/Applications/Templates",
  component: ApplicationTemplates,
  parameters: { layout: "fullscreen" },
  args: { email: "you@example.com", pathname: "/applications" },
} satisfies Meta<typeof ApplicationTemplates>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByRole("link", { name: /休暇の申請/ })).toBeVisible()
    await expect(canvas.queryByRole("link", { name: "テンプレートを作る" })).toBeNull()
  },
}
export const Empty: Story = { parameters: { mockScenario: "empty" } }
export const Error: Story = { parameters: { mockScenario: "error" } }
export const Loading: Story = { parameters: { mockScenario: "slow" } }
export const Mobile: Story = { globals: { viewport: { value: "mobile1", isRotated: false } } }
