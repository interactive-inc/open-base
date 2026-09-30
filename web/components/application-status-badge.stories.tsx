import type { Meta, StoryObj } from "@storybook/react-vite"
import { ApplicationStatusBadge } from "@/components/application-status-badge"

const meta = {
  title: "components/ApplicationStatusBadge",
  component: ApplicationStatusBadge,
} satisfies Meta<typeof ApplicationStatusBadge>

export default meta

type Story = StoryObj<typeof meta>

export const Pending: Story = {
  args: { status: "pending" },
}

export const Approved: Story = {
  args: { status: "approved" },
}

export const Rejected: Story = {
  args: { status: "rejected" },
}
