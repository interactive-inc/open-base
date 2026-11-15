import type { Meta, StoryObj } from "@storybook/react-vite"
import { ApplicationStatusLabel, PhaseBar } from "@/components/app/phase-bar"

const meta = {
  title: "App/PhaseBar",
  component: PhaseBar,
  args: {
    label: "承認の段階",
    phases: [
      { key: "manager", name: "上長", status: "approved" },
      { key: "people", name: "人事", status: "pending" },
      { key: "executive", name: "役員", status: "waiting" },
    ],
  },
  decorators: [(Story) => <div className="w-96">{Story()}</div>],
} satisfies Meta<typeof PhaseBar>
export default meta
type Story = StoryObj<typeof meta>

export const InProgress: Story = {}
export const Rejected: Story = {
  args: {
    phases: [
      { key: "manager", name: "上長", status: "approved" },
      { key: "people", name: "人事", status: "rejected" },
      { key: "executive", name: "役員", status: "waiting" },
    ],
  },
}
export const Returned: Story = {
  args: { phases: [{ key: "manager", name: "とても長い名前の承認段階", status: "returned" }] },
}
export const Dark: Story = { globals: { theme: "dark", backgrounds: { value: "dark" } } }
export const StatusLabels: Story = {
  render: () => (
    <div className="flex gap-2">
      <ApplicationStatusLabel status="pending" />
      <ApplicationStatusLabel status="approved" />
      <ApplicationStatusLabel status="rejected" />
    </div>
  ),
}
