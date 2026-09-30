import type { Meta, StoryObj } from "@storybook/react-vite"
import { EmployeeStatusBadge } from "@/app/(app)/company/employees/_components/employee-status-badge"

const meta = {
  title: "employees/EmployeeStatusBadge",
  component: EmployeeStatusBadge,
} satisfies Meta<typeof EmployeeStatusBadge>

export default meta

type Story = StoryObj<typeof meta>

export const Active: Story = {
  args: { status: "active" },
}

export const Leave: Story = {
  args: { status: "leave" },
}

export const Retired: Story = {
  args: { status: "retired" },
}

export const Unknown: Story = {
  args: { status: "probation" },
}
