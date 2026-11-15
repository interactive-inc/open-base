import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test"
import { createMockState } from "@open-base/mock/seed"
import { ReviewDecisionForm } from "@/components/app/reviews-decision-form"
import type { ReviewSheet, ReviewWorkflowStep } from "@/components/app/reviews-types"

const reviews = createMockState("admin").areas.reviews as { sheets: { data: ReviewSheet }[] }
/** seedで作った順のシート。4が目標の承認待ち、5が評価待ち。 */
const sheet = (n: number) => reviews.sheets[n - 1]!.data
const target = {
  proposal_version: 1,
  proposal_digest: "a".repeat(64),
  task_key: "manager",
  task_round: 1,
}
const MANAGER: ReviewWorkflowStep = {
  key: "manager",
  name: "上長確認",
  approvers: [{ type: "direct_manager" }],
  rejection_behavior: "return",
}
const DEPARTMENT: ReviewWorkflowStep = {
  key: "department",
  name: "部門長確認",
  approvers: [{ type: "department_manager" }],
  rejection_behavior: "return",
}

const meta = {
  title: "App/Reviews/DecisionForm",
  component: ReviewDecisionForm,
  args: { sheet: sheet(4), target, steps: [MANAGER], previous: [], onDecided: fn() },
  decorators: [
    (Story) => (
      <main className="w-[48rem] max-w-full">
        <h1 className="sr-only">評価の判断</h1>
        {Story()}
      </main>
    ),
  ],
} satisfies Meta<typeof ReviewDecisionForm>
export default meta
type Story = StoryObj<typeof meta>

export const Goals: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.queryByRole("button", { name: "却下する" })).toBeNull()
    await userEvent.click(canvas.getByRole("button", { name: "目標を承認する" }))
    await waitFor(() => expect(args.onDecided).toHaveBeenCalledWith("approve", expect.anything()))
  },
}
export const ReturnNeedsReason: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole("button", { name: "差し戻す" }))
    await expect(await canvas.findByRole("alert")).toHaveTextContent("理由を書いてください")
    await expect(args.onDecided).not.toHaveBeenCalled()
  },
}
export const Evaluation: Story = {
  args: { sheet: sheet(5), steps: [MANAGER, DEPARTMENT] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole("list", { name: "承認の段階" })).toBeVisible()
    // 評価を書くそばに、本人の実績と自己評価を出す。
    await expect(canvas.getAllByText("実績")).toHaveLength(sheet(5).goals.length)
    await userEvent.click(canvas.getByRole("button", { name: "評価を承認する" }))
    await expect(await canvas.findByRole("alert")).toHaveTextContent("目標1の点数")
  },
}
export const LastStep: Story = {
  args: { sheet: sheet(5), steps: [MANAGER] },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    for (const [index] of sheet(5).goals.entries()) {
      await userEvent.click(
        canvas.getByRole("combobox", { name: new RegExp(`^目標${index + 1}の\\s*点数$`) }),
      )
      await userEvent.click(await screen.findByRole("option", { name: "3" }))
      await userEvent.type(
        canvas.getByRole("textbox", { name: new RegExp(`^目標${index + 1}の\\s*根拠$`) }),
        "期待どおりでした。",
      )
    }
    // 確定は取り消せないので、送る前に確かめる。見直すを選ぶと送らない。
    await userEvent.click(canvas.getByRole("button", { name: "評価を確定する" }))
    const dialog = await screen.findByRole("alertdialog", { name: "この評価で確定しますか?" })
    await userEvent.click(within(dialog).getByRole("button", { name: "見直す" }))
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull())
    await expect(args.onDecided).not.toHaveBeenCalled()
  },
}
export const UnknownRoute: Story = {
  args: { steps: null },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole("button", { name: "差し戻す" })).toBeVisible()
    await expect(canvas.getByRole("button", { name: "却下する" })).toBeVisible()
  },
}
export const SecondStep: Story = {
  args: {
    sheet: sheet(5),
    target: { ...target, task_key: "department" },
    steps: [MANAGER, DEPARTMENT],
    previous: sheet(5).goals.map((goal) => ({
      goal_id: goal.id,
      score: 4,
      comment: "前の段階で確かめました。",
    })),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getAllByText("前の段階の評価")).toHaveLength(sheet(5).goals.length)
    await expect(canvas.getByRole("button", { name: "評価を確定する" })).toBeVisible()
  },
}
export const Mobile: Story = { globals: { viewport: { value: "mobile1", isRotated: false } } }
