import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, within } from "storybook/test"
import { AccountRoleBindings } from "@/components/app/accounts-role-bindings"

const role = (id: string, key: string, name: string, resourceType: string | null) => ({
  id,
  key,
  kind: "custom" as const,
  resource_type: resourceType,
  name,
  description: null,
  permission_keys: [],
  created_at: "2026-10-01T00:00:00.000Z",
  updated_at: "2026-10-01T00:00:00.000Z",
})

const meta = {
  title: "App/Accounts/RoleBindings",
  component: AccountRoleBindings,
  args: {
    accountId: "00000000-0000-4000-8000-000000000002",
    roles: {
      kind: "ok",
      data: {
        roles: [
          role("00000000-0000-4000-8000-000000000202", "company:member", "従業員", null),
          role("00000000-0000-4000-8000-000000000203", "example:reviewer", "評価の確認", null),
          role(
            "00000000-0000-4000-8000-000000000204",
            "example:project-lead",
            "案件の担当",
            "example:project",
          ),
        ],
        total: 3,
      },
    },
  },
  decorators: [(Story) => <div className="w-[40rem] max-w-full">{Story()}</div>],
} satisfies Meta<typeof AccountRoleBindings>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText("従業員")).toBeVisible()
    await expect(canvas.queryByRole("button")).toBeNull()
  },
}
export const Empty: Story = {
  args: { accountId: "00000000-0000-4000-8000-000000000004" },
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByText(/ロールが付いていません/)).toBeVisible()
  },
}
export const NoRoles: Story = { args: { roles: { kind: "forbidden" } } }
export const Dark: Story = { globals: { theme: "dark", backgrounds: { value: "dark" } } }
