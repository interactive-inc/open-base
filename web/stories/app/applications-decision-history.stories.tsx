import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, within } from "storybook/test"
import { DecisionHistory } from "@/components/app/applications-decision-history"

const meta = {
  title: "App/ApplicationsDecisionHistory",
  component: DecisionHistory,
  args: {
    approvals: [
      {
        id: 1,
        step_key: "manager",
        round: 1,
        approver_name: "Example Manager",
        represented_approver_name: "",
        action: "return",
        comment: "休む日が過ぎています。日付を直してください。",
        created_at: "2026-11-06T01:00:00.000Z",
      },
      {
        id: 2,
        step_key: "manager",
        round: 2,
        approver_name: "Example Deputy",
        represented_approver_name: "Example Manager",
        action: "approve",
        comment: null,
        created_at: "2026-11-08T01:00:00.000Z",
      },
      {
        id: 3,
        step_key: "people",
        round: 1,
        approver_name: "Example People Manager",
        represented_approver_name: "Example People Manager",
        action: "reject",
        comment: "予算を超えています",
        created_at: "2026-11-09T01:00:00.000Z",
      },
    ],
  },
  decorators: [(Story) => <div className="w-96">{Story()}</div>],
} satisfies Meta<typeof DecisionHistory>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText(/Example Manager の代理/)).toBeVisible()
    await expect(canvas.getByText("予算を超えています")).toBeVisible()
    // 本人の判断には代理の表記を付けない。
    await expect(canvas.queryByText(/Example People Manager の代理/)).toBeNull()
  },
}
export const Empty: Story = { args: { approvals: [] } }
export const Mobile: Story = { globals: { viewport: { value: "mobile1", isRotated: false } } }
export const Dark: Story = { globals: { theme: "dark", backgrounds: { value: "dark" } } }
