import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, within } from "storybook/test"
import ReviewDecision from "@/pages/decisions/reviews/[id]"

/** モックのシート。番号は `packages/mock/src/areas/reviews.ts` のseedと同じ。 */
const sheet = (n: number) => `5ee00000-0000-4000-8000-${String(n).padStart(12, "0")}`
const DRAFT = sheet(3)
const GOALS_PENDING = sheet(4)
const EVALUATION_PENDING = sheet(5)

const meta = {
  title: "Pages/Decisions/Reviews",
  component: ReviewDecision,
  parameters: { layout: "fullscreen" },
  args: { id: GOALS_PENDING },
} satisfies Meta<typeof ReviewDecision>
export default meta
type Story = StoryObj<typeof meta>

export const Goals: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByRole("heading", { name: "目標の判断" })).toBeVisible()
    await expect(canvas.getByText("従業員 E-1002 の評価シート")).toBeVisible()
    await expect(await canvas.findByText("2026年度 下期")).toBeVisible()
    await expect(canvas.getByRole("heading", { name: "目標と重み" })).toBeVisible()
    await expect(canvas.getAllByText(/^重み \d+$/)).toHaveLength(3)
  },
}
export const ApproveGoals: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(await canvas.findByRole("button", { name: "目標を承認する" }))
    // 判断の後は結果をこの画面に出し、ほかの画面へは移らない。
    await expect(await canvas.findByText("承認しました。")).toBeVisible()
    await expect(canvas.getByText(/「自己評価中」になりました/)).toBeVisible()
    await expect(canvas.getByRole("link", { name: "評価シートを開く" })).toHaveAttribute(
      "href",
      `/reviews/sheets/${GOALS_PENDING}`,
    )
    await expect(canvas.queryByRole("button", { name: "目標を承認する" })).toBeNull()
  },
}
export const ReturnNeedsReason: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(await canvas.findByRole("button", { name: "差し戻す" }))
    await expect(await canvas.findByRole("alert")).toHaveTextContent("理由を書いてください")
  },
}
export const ReturnGoals: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.type(await canvas.findByLabelText("コメント"), "重みの配分を見直してください。")
    await userEvent.click(canvas.getByRole("button", { name: "差し戻す" }))
    await expect(await canvas.findByText("差し戻しました。")).toBeVisible()
  },
}
export const Evaluation: Story = {
  args: { id: EVALUATION_PENDING },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByRole("heading", { name: "評価の判断" })).toBeVisible()
    // 評価を書くそばに、本人の実績と自己評価を出す。
    await expect(await canvas.findAllByText("自己評価")).toHaveLength(2)
    await userEvent.click(canvas.getByRole("button", { name: "評価を承認する" }))
    await expect(await canvas.findByRole("alert")).toHaveTextContent("目標1の点数")
  },
}
export const NotWaiting: Story = {
  args: { id: DRAFT },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      await canvas.findByText("このシートは今、あなたの判断を待っていません。"),
    ).toBeVisible()
    await expect(canvas.queryByRole("button", { name: /承認する/ })).toBeNull()
  },
}
export const Forbidden: Story = {
  parameters: { mockScenario: "member" },
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByText("表示する権限がありません。")).toBeVisible()
  },
}
export const NotFound: Story = { args: { id: "missing" } }
export const Error: Story = { parameters: { mockScenario: "error" } }
export const Loading: Story = { parameters: { mockScenario: "slow" } }
export const Mobile: Story = {
  args: { id: EVALUATION_PENDING },
  globals: { viewport: { value: "mobile1", isRotated: false } },
}
export const Dark: Story = { globals: { theme: "dark", backgrounds: { value: "dark" } } }
