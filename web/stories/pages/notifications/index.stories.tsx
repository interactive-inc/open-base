import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, within } from "storybook/test"
import Notifications from "@/pages/notifications/index"

const meta = {
  title: "Pages/Notifications/List",
  component: Notifications,
  parameters: { layout: "fullscreen" },
  args: { email: "you@example.com", pathname: "/notifications", unreadOnly: false, offset: 0 },
} satisfies Meta<typeof Notifications>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText("未読の通知が 7 件あります。")).toBeVisible()
    await expect(canvas.getByRole("radio", { name: "すべて" })).toBeChecked()
    await expect(canvas.getByText("全 24 件中 1–20 件目")).toBeVisible()
    await expect(canvas.getByRole("link", { name: "次へ" })).toHaveAttribute(
      "href",
      "/notifications?offset=20",
    )
  },
}

export const MarkOneRead: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const buttons = await canvas.findAllByRole("button", { name: /^既読にする/ })
    await userEvent.click(buttons[0]!)
    await expect(await canvas.findByText("未読の通知が 6 件あります。")).toBeVisible()
  },
}

export const MarkAllRead: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(await canvas.findByRole("button", { name: "すべて既読にする" }))
    await expect(await canvas.findByText("あなた宛ての通知がここに届きます。")).toBeVisible()
    await expect(canvas.queryByRole("button", { name: /^既読にする/ })).toBeNull()
  },
}

export const UnreadOnly: Story = {
  args: { unreadOnly: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText("全 7 件中 1–7 件目")).toBeVisible()
    await expect(await canvas.findByRole("radio", { name: "未読だけ（7）" })).toBeChecked()
    await expect(canvas.getAllByRole("link", { name: /^関連する画面を開く/ })[0]).toHaveAttribute(
      "href",
      "/applications/101",
    )
  },
}

export const SecondPage: Story = { args: { offset: 20 } }
export const Empty: Story = {
  parameters: { mockScenario: "empty" },
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByText("通知はまだありません")).toBeVisible()
  },
}
export const Error: Story = { parameters: { mockScenario: "error" } }
export const Loading: Story = { parameters: { mockScenario: "slow" } }
export const Mobile: Story = { globals: { viewport: { value: "mobile1", isRotated: false } } }
export const Dark: Story = { globals: { theme: "dark", backgrounds: { value: "dark" } } }
