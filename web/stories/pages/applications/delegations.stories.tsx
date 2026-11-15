import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, within } from "storybook/test"
import ApprovalDelegations from "@/pages/applications/delegations"

const meta = {
  title: "Pages/Applications/Delegations",
  component: ApprovalDelegations,
  parameters: { layout: "fullscreen" },
  args: { email: "you@example.com", pathname: "/applications" },
} satisfies Meta<typeof ApprovalDelegations>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText(/Example Member へ/)).toBeVisible()
    await expect(canvas.getByText(/Example Manager から/)).toBeVisible()
    await expect(canvas.queryByRole("button", { name: "代理を頼む" })).toBeNull()
    await expect(canvas.queryByRole("button", { name: "取り消す" })).toBeNull()
  },
}
export const Empty: Story = { parameters: { mockScenario: "empty" } }
export const Error: Story = { parameters: { mockScenario: "error" } }
export const Loading: Story = { parameters: { mockScenario: "slow" } }
export const Mobile: Story = { globals: { viewport: { value: "mobile1", isRotated: false } } }
