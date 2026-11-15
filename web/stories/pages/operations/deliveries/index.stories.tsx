import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, within } from "storybook/test"
import Deliveries from "@/pages/operations/deliveries/index"

const meta = {
  title: "Pages/Operations/Deliveries",
  component: Deliveries,
  parameters: { layout: "fullscreen" },
  args: { email: "you@example.com", pathname: "/operations" },
} satisfies Meta<typeof Deliveries>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText(/2 件が止まっています/)).toBeVisible()
    await expect(await canvas.findByText("保存先に接続できませんでした")).toBeVisible()
    await expect(canvas.getByRole("tab", { name: /ジョブ（止まっている 1 件）/ })).toBeVisible()
  },
}
export const ExpiredLease: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect((await canvas.findAllByText("処理が止まった")).length).toBeGreaterThan(0)
    await expect(canvas.queryByRole("button", { name: "待機に戻す" })).toBeNull()
    await expect(canvas.queryByRole("button", { name: "流し直す" })).toBeNull()
  },
}
export const NothingStopped: Story = {
  parameters: { mockScenario: "empty" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText("止まっている処理はありません。")).toBeVisible()
  },
}
export const Forbidden: Story = { parameters: { mockScenario: "member" } }
export const Error: Story = { parameters: { mockScenario: "error" } }
export const Loading: Story = { parameters: { mockScenario: "slow" } }
export const Mobile: Story = { globals: { viewport: { value: "mobile1", isRotated: false } } }
