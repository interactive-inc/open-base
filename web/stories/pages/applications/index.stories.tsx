import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, within } from "storybook/test"
import Applications from "@/pages/applications/index"

const meta = {
  title: "Pages/Applications/List",
  component: Applications,
  parameters: { layout: "fullscreen" },
  args: { email: "you@example.com", pathname: "/applications" },
} satisfies Meta<typeof Applications>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // 備品の購入は却下されたものと承認待ちのものの二件がある。
    await expect((await canvas.findAllByText("備品の購入")).length).toBe(2)
    await expect(canvas.getByText("却下")).toBeVisible()
    await expect(canvas.getByText("差し戻し")).toBeVisible()
    // 申請の領域の中の画面へは、サイドバーの子項目から移る。
    for (const name of ["テンプレート", "全社の申請", "承認の代理", "止まった申請の修復"])
      await expect(canvas.getByRole("link", { name })).toBeVisible()
    await expect(canvas.queryByRole("link", { name: "申請する" })).toBeNull()
  },
}
export const Empty: Story = { parameters: { mockScenario: "empty" } }
export const Error: Story = { parameters: { mockScenario: "error" } }
export const Loading: Story = { parameters: { mockScenario: "slow" } }
export const Mobile: Story = { globals: { viewport: { value: "mobile1", isRotated: false } } }
