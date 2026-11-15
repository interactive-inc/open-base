import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, within } from "storybook/test"
import Accounts from "@/pages/accounts/index"

const meta = {
  title: "Pages/Accounts/List",
  component: Accounts,
  parameters: { layout: "fullscreen" },
  args: { email: "you@example.com", pathname: "/accounts" },
} satisfies Meta<typeof Accounts>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText("Example Member")).toBeVisible()
    await expect(canvas.getByText("停止中")).toBeVisible()
    await expect(canvas.getAllByText("従業員と未連携").length).toBeGreaterThan(0)
    await expect(await canvas.findByText("システム管理者")).toBeVisible()
  },
}
export const Empty: Story = {
  parameters: { mockScenario: "empty" },
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByText("まだアカウントがありません")).toBeVisible()
  },
}
export const Forbidden: Story = {
  parameters: { mockScenario: "member" },
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByText("表示する権限がありません。")).toBeVisible()
  },
}
export const Error: Story = { parameters: { mockScenario: "error" } }
export const Loading: Story = { parameters: { mockScenario: "slow" } }
export const Mobile: Story = { globals: { viewport: { value: "mobile1", isRotated: false } } }
export const Dark: Story = { globals: { theme: "dark", backgrounds: { value: "dark" } } }
