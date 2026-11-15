import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, within } from "storybook/test"
import ReviewCycle from "@/pages/reviews/cycles/[id]"

const CURRENT = "c1000000-0000-4000-8000-000000000001"
const OLDEST = "c1000000-0000-4000-8000-000000000004"

const meta = {
  title: "Pages/Reviews/Cycle",
  component: ReviewCycle,
  parameters: { layout: "fullscreen" },
  args: { email: "you@example.com", pathname: "/reviews", id: CURRENT },
} satisfies Meta<typeof ReviewCycle>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByRole("heading", { name: "2026年度 下期" })).toBeVisible()
    await expect(await canvas.findByText("全 6 件")).toBeVisible()
    // 目標と評価の両方の承認経路に、上長確認が一段目として並ぶ。
    await expect(canvas.getAllByText("1. 上長確認（直属の上長・戻すときは差し戻し）")).toHaveLength(
      2,
    )
    await expect(canvas.getByText("2. 部門長確認（部門長・戻すときは差し戻し）")).toBeVisible()
  },
}
export const WithoutReadAll: Story = {
  parameters: { mockScenario: "member" },
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByText(/進み具合の集計は出せません/)).toBeVisible()
  },
}
export const NoSheetYet: Story = {
  args: { id: OLDEST },
  parameters: { mockScenario: "member" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText(/この期間のシートはまだありません/)).toBeVisible()
    await expect(canvas.queryByRole("link", { name: /シートを作る/ })).toBeNull()
  },
}
export const NotFound: Story = { args: { id: "missing" } }
export const Error: Story = { parameters: { mockScenario: "error" } }
export const Loading: Story = { parameters: { mockScenario: "slow" } }
export const Mobile: Story = { globals: { viewport: { value: "mobile1", isRotated: false } } }
