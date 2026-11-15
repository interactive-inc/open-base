import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, within, userEvent } from "storybook/test"
import Enroll from "@/pages/enroll"

const meta = {
  title: "Pages/Enroll",
  component: Enroll,
  parameters: { layout: "fullscreen" },
  args: { token: "preview-invitation" },
} satisfies Meta<typeof Enroll>
export default meta
type Story = StoryObj<typeof meta>
export const Invitation: Story = {}
export const MissingInvitation: Story = { args: { token: null } }
export const Unavailable: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole("button", { name: "パスキーを登録" }))
    await expect(await canvas.findByRole("alert")).toBeVisible()
  },
}
