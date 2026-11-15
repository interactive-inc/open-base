import type { Meta, StoryObj } from "@storybook/react-vite"
import {
  EmployeeStatusLabel,
  EventStatusLabel,
  RequestStatusLabel,
} from "@/components/app/employees-status"

const meta = {
  title: "App/Employees/Status",
  component: EmployeeStatusLabel,
  args: { status: "active" },
} satisfies Meta<typeof EmployeeStatusLabel>
export default meta
type Story = StoryObj<typeof meta>

export const Active: Story = {}
export const All: Story = {
  render: () => (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <EmployeeStatusLabel status="active" />
        <EmployeeStatusLabel status="leave" />
        <EmployeeStatusLabel status="retired" />
        <EmployeeStatusLabel status="inactive" />
        <EmployeeStatusLabel status="prehire" />
      </div>
      <div className="flex flex-wrap gap-2">
        <EventStatusLabel status="confirmed" />
        <EventStatusLabel status="scheduled" />
        <EventStatusLabel status="corrected" />
        <EventStatusLabel status="correction" />
      </div>
      <div className="flex flex-wrap gap-2">
        <RequestStatusLabel status="pending" />
        <RequestStatusLabel status="approved" />
        <RequestStatusLabel status="rejected" />
        <RequestStatusLabel status="withdrawn" />
      </div>
    </div>
  ),
}
export const Dark: Story = {
  render: All.render,
  globals: { theme: "dark", backgrounds: { value: "dark" } },
}
