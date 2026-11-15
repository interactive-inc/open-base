import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, within } from "storybook/test"
import ApplicationDetail from "@/pages/applications/[id]"

const meta = {
  title: "Pages/Applications/Detail",
  component: ApplicationDetail,
  parameters: { layout: "fullscreen" },
  args: { email: "you@example.com", pathname: "/applications", id: "101" },
} satisfies Meta<typeof ApplicationDetail>
export default meta
type Story = StoryObj<typeof meta>

export const WaitingForMe: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText("あなたの判断を待っています")).toBeVisible()
    await expect(await canvas.findByText("休む日")).toBeVisible()
    await expect(canvas.getByRole("link", { name: "判断する" })).toHaveAttribute(
      "href",
      "/decisions/applications/101",
    )
    await expect(canvas.queryByRole("button", { name: "承認する" })).toBeNull()
  },
}
export const InProgress: Story = {
  args: { id: "103" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText("これまでの判断")).toBeVisible()
    await expect(canvas.queryByRole("link", { name: "判断する" })).toBeNull()
    await expect(canvas.queryByRole("button", { name: "取り下げる" })).toBeNull()
  },
}
export const Returned: Story = {
  args: { id: "105" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText("日付を直してください", { exact: false })).toBeVisible()
    await expect(canvas.queryByRole("button", { name: "直して出し直す" })).toBeNull()
  },
}
export const WithoutWorkflow: Story = {
  args: { id: "106" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText("キーボード")).toBeVisible()
    await expect(canvas.queryByRole("button", { name: "内容を変える" })).toBeNull()
  },
}
export const Rejected: Story = { args: { id: "104" } }
export const NotFound: Story = { args: { id: "999" } }
export const Loading: Story = { parameters: { mockScenario: "slow" } }
export const Error: Story = { parameters: { mockScenario: "error" } }
export const Mobile: Story = { globals: { viewport: { value: "mobile1", isRotated: false } } }
export const Dark: Story = { globals: { theme: "dark", backgrounds: { value: "dark" } } }
