import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, within, userEvent } from "storybook/test"
import Home from "@/pages/index"

const meta = {
  title: "Pages/Home",
  component: Home,
  parameters: { layout: "fullscreen" },
  args: { email: "you@example.com", pathname: "/" },
} satisfies Meta<typeof Home>
export default meta
type Story = StoryObj<typeof meta>

export const Admin: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText("休暇の申請")).toBeVisible()
    await userEvent.click(canvas.getByRole("button", { name: /ユーザーメニュー/ }))
    await expect(
      await within(document.body).findByRole("menuitem", { name: "サインアウト" }),
    ).toBeVisible()
    await userEvent.keyboard("{Escape}")
  },
}
export const Member: Story = { parameters: { mockScenario: "member" } }
export const Empty: Story = {
  parameters: { mockScenario: "empty" },
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByText("判断を待っている申請はありません"),
    ).toBeVisible()
  },
}
export const Forbidden: Story = { parameters: { mockScenario: "unlinked" } }
export const Error: Story = { parameters: { mockScenario: "error" } }
export const Loading: Story = { parameters: { mockScenario: "slow" } }
export const Mobile: Story = {
  globals: { viewport: { value: "mobile1", isRotated: false } },
}
export const Dark: Story = { globals: { theme: "dark", backgrounds: { value: "dark" } } }
