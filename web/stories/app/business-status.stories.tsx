import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, within } from "storybook/test"
import {
  CatalogStatusLabel,
  ProjectStage,
  ProjectStatusLabel,
  VoidLabel,
  WorkDefinitionStatusLabel,
  WorkOutcomeLabel,
} from "@/components/app/business-status"

const meta = {
  title: "App/BusinessStatus",
  component: ProjectStage,
  args: { status: "active", label: "案件の段階" },
  decorators: [(Story) => <div className="w-96">{Story()}</div>],
} satisfies Meta<typeof ProjectStage>
export default meta
type Story = StoryObj<typeof meta>

export const Active: Story = {
  play: async ({ canvasElement }) => {
    const current = within(canvasElement).getByRole("listitem", { current: "step" })
    await expect(current).toHaveTextContent("進行中")
  },
}
export const Planned: Story = { args: { status: "planned" } }
export const Completed: Story = { args: { status: "completed" } }
export const Cancelled: Story = {
  args: { status: "cancelled" },
  play: async ({ canvasElement }) => {
    // 中止は段階の並びの外にあるので、並びを出さずに文で知らせる。
    const canvas = within(canvasElement)
    await expect(canvas.getByText("中止 · この案件は止まっています")).toBeVisible()
    await expect(canvas.queryByRole("list", { name: "案件の段階" })).toBeNull()
  },
}
export const Dark: Story = { globals: { theme: "dark", backgrounds: { value: "dark" } } }
export const Labels: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <ProjectStatusLabel status="planned" />
      <ProjectStatusLabel status="active" />
      <ProjectStatusLabel status="completed" />
      <ProjectStatusLabel status="cancelled" />
      <CatalogStatusLabel status="active" />
      <CatalogStatusLabel status="inactive" />
      <WorkOutcomeLabel outcome="succeeded" />
      <WorkOutcomeLabel outcome="failed" />
      <WorkOutcomeLabel outcome="needs_review" />
      <WorkDefinitionStatusLabel status="active" />
      <WorkDefinitionStatusLabel status="retired" />
      <VoidLabel />
    </div>
  ),
}
