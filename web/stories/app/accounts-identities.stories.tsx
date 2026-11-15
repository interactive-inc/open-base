import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, within } from "storybook/test"
import { AccountIdentities } from "@/components/app/accounts-identities"

const meta = {
  title: "App/Accounts/Identities",
  component: AccountIdentities,
  args: { accountId: "00000000-0000-4000-8000-000000000002" },
  decorators: [(Story) => <div className="w-[40rem] max-w-full">{Story()}</div>],
} satisfies Meta<typeof AccountIdentities>
export default meta
type Story = StoryObj<typeof meta>

export const PasskeyAndPassword: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText("パスキー")).toBeVisible()
    await expect(canvas.getByText("パスワード")).toBeVisible()
    await expect(canvas.queryByRole("button")).toBeNull()
  },
}
export const PendingPasskey: Story = {
  args: { accountId: "00000000-0000-4000-8000-000000000004" },
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByText("登録待ち")).toBeVisible()
  },
}
export const AccountNotFound: Story = { parameters: { mockScenario: "empty" } }
export const Loading: Story = { parameters: { mockScenario: "slow" } }
export const Dark: Story = { globals: { theme: "dark", backgrounds: { value: "dark" } } }
