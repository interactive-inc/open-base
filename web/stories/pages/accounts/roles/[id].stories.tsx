import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, within } from "storybook/test"
import RoleDetail from "@/pages/accounts/roles/[id]"

const meta = {
  title: "Pages/Accounts/Roles/Detail",
  component: RoleDetail,
  parameters: { layout: "fullscreen" },
  args: {
    email: "you@example.com",
    pathname: "/accounts",
    id: "00000000-0000-4000-8000-000000000203",
  },
} satisfies Meta<typeof RoleDetail>
export default meta
type Story = StoryObj<typeof meta>

export const Custom: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByRole("heading", { level: 1, name: "評価の確認" })).toBeVisible()
    await expect(canvas.getByText("評価を見る")).toBeVisible()
    await expect(canvas.getByText("独自")).toBeVisible()
    await expect(canvas.queryByRole("button", { name: "保存する" })).toBeNull()
    await expect(canvas.queryByRole("button", { name: "削除する" })).toBeNull()
  },
}
export const Managed: Story = {
  args: { id: "00000000-0000-4000-8000-000000000201" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText("標準で用意されたロールです。")).toBeVisible()
    await expect(canvas.getByText("アカウントとロールを変える")).toBeVisible()
  },
}
export const NotFound: Story = { args: { id: "00000000-0000-4000-8000-000000000999" } }
export const Loading: Story = { parameters: { mockScenario: "slow" } }
export const Mobile: Story = { globals: { viewport: { value: "mobile1", isRotated: false } } }
