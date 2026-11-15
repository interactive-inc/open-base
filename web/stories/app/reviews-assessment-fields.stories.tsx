import type { Meta, StoryObj } from "@storybook/react-vite"
import { useState } from "react"
import { expect, screen, userEvent, within } from "storybook/test"
import {
  ReviewAssessmentFields,
  type AssessmentDrafts,
  type AssessmentProblem,
} from "@/components/app/reviews-assessment-fields"
import type {
  ReviewAssessment,
  ReviewGoal,
  ReviewPolicy,
  ReviewSelfAssessment,
} from "@/components/app/reviews-types"

const POLICY: ReviewPolicy = {
  version: 1,
  scale: [
    { value: 1, label: "届かない" },
    { value: 2, label: "一部届く" },
    { value: 3, label: "期待どおり" },
    { value: 4, label: "期待を超える" },
  ],
  sections: [{ key: "mbo", name: "目標", weight: 100 }],
}
const GOALS: ReviewGoal[] = [
  {
    id: "9a000000-0000-4000-8000-000000000001",
    title: "Example 目標",
    success_criteria: "期末までに公開する",
    weight: 70,
    section_key: "mbo",
  },
  {
    id: "9a000000-0000-4000-8000-000000000002",
    title: "後輩の育成",
    success_criteria: "後輩2人が一人で作業を進められるようにする",
    weight: 30,
    section_key: "mbo",
  },
]

const SELF: ReviewSelfAssessment[] = [
  {
    goal_id: "9a000000-0000-4000-8000-000000000001",
    actual: "予定どおりに公開した",
    score: 3,
    comment: "期日を守れた",
  },
]
const PREVIOUS: ReviewAssessment[] = [
  { goal_id: "9a000000-0000-4000-8000-000000000001", score: 4, comment: "期待を超えた" },
]

/** 入力を持つ親の代わり。 */
function Fields(props: {
  previous?: ReviewAssessment[]
  error?: AssessmentProblem
  disabled?: boolean
}) {
  const [drafts, setDrafts] = useState<AssessmentDrafts>({})
  return (
    <ReviewAssessmentFields
      goals={GOALS}
      policy={POLICY}
      selfAssessments={SELF}
      previous={props.previous ?? []}
      drafts={drafts}
      onChange={setDrafts}
      error={props.error}
      disabled={props.disabled}
    />
  )
}

const meta = {
  title: "App/Reviews/AssessmentFields",
  component: Fields,
  args: {},
  decorators: [(Story) => <div className="w-[40rem] max-w-full">{Story()}</div>],
} satisfies Meta<typeof Fields>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText("予定どおりに公開した")).toBeVisible()
    await expect(canvas.getByText("3（期待どおり）")).toBeVisible()
    await expect(canvas.queryByText("前の段階の評価")).toBeNull()
    // 入力の名前は目標の番号を含み、画面の中で重ならない。
    await userEvent.click(canvas.getByRole("combobox", { name: /^目標1の\s*点数$/ }))
    await userEvent.click(await screen.findByRole("option", { name: "4（期待を超える）" }))
    await expect(canvas.getByRole("combobox", { name: /^目標1の\s*点数$/ })).toHaveTextContent(
      "4（期待を超える）",
    )
    await expect(canvas.getByRole("textbox", { name: /^目標2の\s*根拠$/ })).toBeVisible()
  },
}
export const WithPreviousStep: Story = {
  args: { previous: PREVIOUS },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText("前の段階の評価")).toBeVisible()
  },
}
export const WithError: Story = {
  args: {
    error: {
      goalId: "9a000000-0000-4000-8000-000000000002",
      field: "comment",
      message: "目標2の根拠を入力してください。",
    },
  },
  play: async ({ canvasElement }) => {
    // 足りない入力は、その欄の下に出す。
    await expect(within(canvasElement).getByRole("alert")).toHaveTextContent("目標2の根拠")
  },
}
export const Disabled: Story = { args: { disabled: true } }
