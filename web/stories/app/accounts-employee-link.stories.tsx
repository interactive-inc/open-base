import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, within } from "storybook/test"
import { AccountEmployeeLinkPanel } from "@/components/app/accounts-employee-link"

const meta = {
  title: "App/Accounts/EmployeeLink",
  component: AccountEmployeeLinkPanel,
  args: {
    accountId: "00000000-0000-4000-8000-000000000002",
    organizationId: "example-organization",
    person: {
      account_id: "00000000-0000-4000-8000-000000000002",
      name: "Example Member",
      email: "e0002@example.com",
      status: "active",
    },
  },
  decorators: [(Story) => <div className="w-[40rem] max-w-full">{Story()}</div>],
} satisfies Meta<typeof AccountEmployeeLinkPanel>
export default meta
type Story = StoryObj<typeof meta>

export const Linked: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText(/と結び付いています/)).toBeVisible()
    await expect(canvas.queryByRole("button")).toBeNull()
  },
}
export const NotLinked: Story = {
  args: { accountId: "00000000-0000-4000-8000-000000000004", person: undefined },
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByText(/まだ従業員と結び付いていません/),
    ).toBeVisible()
  },
}
export const NoOrganization: Story = { args: { organizationId: null } }
export const Forbidden: Story = { parameters: { mockScenario: "member" } }
export const Dark: Story = { globals: { theme: "dark", backgrounds: { value: "dark" } } }
