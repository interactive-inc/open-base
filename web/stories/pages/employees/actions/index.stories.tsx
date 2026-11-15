import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, within } from "storybook/test"
import PersonnelActions from "@/pages/employees/actions/index"

const meta = {
  title: "Pages/Employees/Actions",
  component: PersonnelActions,
  parameters: { layout: "fullscreen" },
  args: { email: "you@example.com", pathname: "/employees" },
} satisfies Meta<typeof PersonnelActions>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText("訂正済み")).toBeVisible()
    await expect(canvas.queryByRole("link", { name: "訂正する" })).toBeNull()
  },
}
export const Requests: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(await canvas.findByRole("tab", { name: "申請" }))
    await expect(await canvas.findByText("承認待ち")).toBeVisible()
    await expect(canvas.getByText("却下")).toBeVisible()
  },
}
export const Empty: Story = { parameters: { mockScenario: "empty" } }
export const Error: Story = { parameters: { mockScenario: "error" } }
export const Loading: Story = { parameters: { mockScenario: "slow" } }
export const Forbidden: Story = {
  parameters: { mockScenario: "member" },
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByText("表示する権限がありません。")).toBeVisible()
  },
}
export const Mobile: Story = { globals: { viewport: { value: "mobile1", isRotated: false } } }
