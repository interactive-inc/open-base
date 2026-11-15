import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, within } from "storybook/test"
import ReviewSheet from "@/pages/reviews/sheets/[id]"

/** モックのシート。番号は `packages/mock/src/areas/reviews.ts` のseedと同じ。 */
const sheet = (n: number) => `5ee00000-0000-4000-8000-${String(n).padStart(12, "0")}`
const SELF_EVALUATION = sheet(1)
const FINALIZED = sheet(2)
const DRAFT = sheet(3)
const GOALS_PENDING = sheet(4)
const EVALUATION_PENDING = sheet(5)
const RETURNED = sheet(6)
const CANCELLED = sheet(7)

const meta = {
  title: "Pages/Reviews/Sheet",
  component: ReviewSheet,
  parameters: { layout: "fullscreen" },
  args: { email: "you@example.com", pathname: "/reviews", id: DRAFT },
} satisfies Meta<typeof ReviewSheet>
export default meta
type Story = StoryObj<typeof meta>

export const Draft: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      await canvas.findByRole("heading", { name: "目標を確かめて提出する" }),
    ).toBeVisible()
    await expect(await canvas.findByText("あなたの番")).toBeVisible()
    await expect(await canvas.findByText("シートを作成")).toBeVisible()
    // 本人の書き込みはCLIかMCPで行う。画面には入力も操作のボタンも出さない。
    await expect(canvas.getByText(/CLI か MCP で行います/)).toBeVisible()
    await expect(canvas.queryByRole("textbox")).toBeNull()
    await expect(canvas.queryByRole("button", { name: /提出する|取り消す/ })).toBeNull()
  },
}
export const SelfEvaluation: Story = {
  args: { id: SELF_EVALUATION },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByRole("heading", { name: "実績と自己評価を書く" })).toBeVisible()
    await expect(canvas.queryByRole("combobox")).toBeNull()
  },
}
export const CanDecide: Story = {
  args: { id: GOALS_PENDING },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      await canvas.findByRole("heading", { name: "目標を確認して判断する" }),
    ).toBeVisible()
    // 判断のフォームはシートに置かず、判断の画面へのリンクだけを出す。
    await expect(await canvas.findByRole("link", { name: "判断する" })).toHaveAttribute(
      "href",
      `/decisions/reviews/${GOALS_PENDING}`,
    )
    await expect(canvas.queryByRole("button", { name: "目標を承認する" })).toBeNull()
  },
}
export const EvaluationPending: Story = {
  args: { id: EVALUATION_PENDING },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      await canvas.findByRole("heading", { name: "目標ごとに評価を書いて判断する" }),
    ).toBeVisible()
    await expect(await canvas.findByRole("link", { name: "判断する" })).toHaveAttribute(
      "href",
      `/decisions/reviews/${EVALUATION_PENDING}`,
    )
  },
}
export const NotYourTurn: Story = {
  args: { id: RETURNED },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText("本人の番")).toBeVisible()
    await expect(canvas.queryByRole("link", { name: "判断する" })).toBeNull()
  },
}
export const Returned: Story = {
  args: { id: RETURNED },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText(/差し戻しの理由/)).toBeVisible()
    await expect(canvas.getAllByText("目標2の達成の基準を数字で書いてください。")).toHaveLength(2)
    await expect(await canvas.findByText("本人の番")).toBeVisible()
  },
}
export const Finalized: Story = {
  args: { id: FINALIZED },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByRole("heading", { name: "評価は確定しました" })).toBeVisible()
    await expect(await canvas.findByText("評価者の評価の合計")).toBeVisible()
  },
}
export const Cancelled: Story = { args: { id: CANCELLED } }
export const Forbidden: Story = {
  args: { id: GOALS_PENDING },
  parameters: { mockScenario: "member" },
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByText("表示する権限がありません。")).toBeVisible()
  },
}
export const NotFound: Story = { args: { id: "missing" } }
export const Error: Story = { parameters: { mockScenario: "error" } }
export const Loading: Story = { parameters: { mockScenario: "slow" } }
export const Mobile: Story = {
  args: { id: SELF_EVALUATION },
  globals: { viewport: { value: "mobile1", isRotated: false } },
}
export const Dark: Story = {
  args: { id: EVALUATION_PENDING },
  globals: { theme: "dark", backgrounds: { value: "dark" } },
}
