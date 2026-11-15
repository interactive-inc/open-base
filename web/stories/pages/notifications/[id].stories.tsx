import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, within } from "storybook/test"
import NotificationDetail from "@/pages/notifications/[id]"

const meta = {
  title: "Pages/Notifications/Detail",
  component: NotificationDetail,
  parameters: { layout: "fullscreen" },
  args: { email: "you@example.com", pathname: "/notifications", id: "notification-1" },
} satisfies Meta<typeof NotificationDetail>
export default meta
type Story = StoryObj<typeof meta>

export const Unread: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      await canvas.findByRole("heading", { level: 1, name: "申請が届きました" }),
    ).toBeVisible()
    await expect(canvas.getByText("重要")).toBeVisible()
    await expect(canvas.getByRole("link", { name: /関連する画面を開く/ })).toHaveAttribute(
      "href",
      "/applications/101",
    )
  },
}
export const MarkRead: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(await canvas.findByRole("button", { name: "既読にする" }))
    await expect(await canvas.findByText(/に既読$/)).toBeVisible()
    await expect(canvas.queryByRole("button", { name: "既読にする" })).toBeNull()
  },
}
export const Read: Story = { args: { id: "notification-11" } }
export const WithoutBody: Story = { args: { id: "notification-3" } }
export const NotFound: Story = {
  args: { id: "notification-999" },
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByText("表示する権限がありません。")).toBeVisible()
  },
}
export const Error: Story = { parameters: { mockScenario: "error" } }
export const Loading: Story = { parameters: { mockScenario: "slow" } }
export const Mobile: Story = { globals: { viewport: { value: "mobile1", isRotated: false } } }
export const Dark: Story = { globals: { theme: "dark", backgrounds: { value: "dark" } } }
