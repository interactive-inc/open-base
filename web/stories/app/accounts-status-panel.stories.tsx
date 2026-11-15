import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, within } from "storybook/test"
import { AccountStatusPanel } from "@/components/app/accounts-status-panel"

const account = {
  id: "00000000-0000-4000-8000-000000000003",
  status: "suspended" as const,
  token_version: 1,
  role_keys: [],
  created_at: "2026-10-06T00:00:00.000Z",
  updated_at: "2026-10-06T00:00:00.000Z",
}

const meta = {
  title: "App/Accounts/StatusPanel",
  component: AccountStatusPanel,
  args: { account },
  decorators: [(Story) => <div className="w-[36rem] max-w-full">{Story()}</div>],
} satisfies Meta<typeof AccountStatusPanel>
export default meta
type Story = StoryObj<typeof meta>

export const Suspended: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText("停止中")).toBeVisible()
    await expect(canvas.queryByRole("button")).toBeNull()
  },
}
export const Active: Story = { args: { account: { ...account, status: "active" } } }
export const Locked: Story = { args: { account: { ...account, status: "locked" } } }
export const Dark: Story = { globals: { theme: "dark", backgrounds: { value: "dark" } } }
