import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, within } from "storybook/test"
import Reviews from "@/pages/reviews/index"

const meta = {
  title: "Pages/Reviews/List",
  component: Reviews,
  parameters: { layout: "fullscreen" },
  args: { email: "you@example.com", pathname: "/reviews" },
} satisfies Meta<typeof Reviews>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText(/あなたの判断を待っているシートが/)).toBeVisible()
    await expect(canvas.getByRole("heading", { name: "2026年度 下期" })).toBeVisible()
    await expect(canvas.getAllByText("あなたの評価シート")).toHaveLength(3)
    await expect(canvas.getByText(/E-1002 の評価シート/)).toBeVisible()
    await expect(canvas.queryByRole("link", { name: /シートを作る/ })).toBeNull()
  },
}
export const Member: Story = {
  parameters: { mockScenario: "member" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findAllByText("あなたの評価シート")).toHaveLength(3)
    await expect(canvas.queryByText(/あなたの判断を待っているシートが/)).toBeNull()
  },
}
export const Empty: Story = {
  parameters: { mockScenario: "empty" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText("まだ評価シートがありません")).toBeVisible()
    await expect(canvas.getByText(/CLI か MCP で評価シートを登録すると/)).toBeVisible()
  },
}
export const Error: Story = { parameters: { mockScenario: "error" } }
export const Loading: Story = { parameters: { mockScenario: "slow" } }
export const Mobile: Story = { globals: { viewport: { value: "mobile1", isRotated: false } } }
