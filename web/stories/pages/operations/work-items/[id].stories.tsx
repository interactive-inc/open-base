import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, within } from "storybook/test"
import WorkItemPage from "@/pages/operations/work-items/[id]"

const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`

const meta = {
  title: "Pages/Operations/WorkItems/Detail",
  component: WorkItemPage,
  parameters: { layout: "fullscreen" },
  args: { email: "you@example.com", pathname: "/operations", id: ID(501) },
} satisfies Meta<typeof WorkItemPage>
export default meta
type Story = StoryObj<typeof meta>

export const ReviewPending: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText("提出された成果")).toBeVisible()
    await expect(canvas.getByText("権限を持つ12件を確かめ、不要な2件を外しました。")).toBeVisible()
    await expect(canvas.queryByRole("button", { name: "承認して完了する" })).toBeNull()
    await expect(canvas.queryByRole("button", { name: "中止する" })).toBeNull()
  },
}
export const Offered: Story = {
  args: { id: ID(502) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      await canvas.findByRole("heading", { name: "Example 退職者のアカウントの停止" }),
    ).toBeVisible()
    await expect(canvas.queryByRole("button", { name: "受領する" })).toBeNull()
  },
}
export const HandoverWaiting: Story = {
  args: { id: ID(503) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText("責任の引き継ぎを待っています")).toBeVisible()
    await expect(canvas.getByText("引き継ぐ先")).toBeVisible()
    await expect(canvas.queryByRole("button", { name: "引き継ぎを断る" })).toBeNull()
  },
}
export const Completed: Story = { args: { id: ID(504) } }
export const Cancelled: Story = { args: { id: ID(505) } }
export const NotFound: Story = { args: { id: ID(999) } }
export const Loading: Story = { parameters: { mockScenario: "slow" } }
export const Mobile: Story = { globals: { viewport: { value: "mobile1", isRotated: false } } }
