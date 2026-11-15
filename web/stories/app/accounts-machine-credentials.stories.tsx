import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, within } from "storybook/test"
import { MachineCredentials } from "@/components/app/accounts-machine-credentials"

const meta = {
  title: "App/Accounts/MachineCredentials",
  component: MachineCredentials,
  args: { principalId: "00000000-0000-4000-8000-000000000402" },
  decorators: [(Story) => <div className="w-[40rem] max-w-full">{Story()}</div>],
} satisfies Meta<typeof MachineCredentials>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByText("Example nightly job")).toBeVisible()
  },
}
export const Empty: Story = { args: { principalId: "00000000-0000-4000-8000-000000000401" } }
export const Loading: Story = { parameters: { mockScenario: "slow" } }
export const Dark: Story = { globals: { theme: "dark", backgrounds: { value: "dark" } } }
