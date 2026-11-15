import type { Meta, StoryObj } from "@storybook/react-vite"
import { AccountStatusLabel, IdentityStateLabel } from "@/components/app/accounts-labels"

const meta = {
  title: "App/Accounts/Labels",
  component: AccountStatusLabel,
  args: { status: "active" },
} satisfies Meta<typeof AccountStatusLabel>
export default meta
type Story = StoryObj<typeof meta>

export const Active: Story = {}
export const Suspended: Story = { args: { status: "suspended" } }
export const Locked: Story = { args: { status: "locked" } }
export const All: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <AccountStatusLabel status="active" />
      <AccountStatusLabel status="suspended" />
      <AccountStatusLabel status="locked" />
      <IdentityStateLabel state="active" />
      <IdentityStateLabel state="pending" />
      <IdentityStateLabel state="revoked" />
    </div>
  ),
}
export const Dark: Story = {
  ...All,
  globals: { theme: "dark", backgrounds: { value: "dark" } },
}
