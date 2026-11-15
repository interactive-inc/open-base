import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, within } from "storybook/test"
import PrincipalDetail from "@/pages/accounts/principals/[id]"

const meta = {
  title: "Pages/Accounts/Principals/Detail",
  component: PrincipalDetail,
  parameters: { layout: "fullscreen" },
  args: {
    email: "you@example.com",
    pathname: "/accounts",
    id: "00000000-0000-4000-8000-000000000402",
  },
} satisfies Meta<typeof PrincipalDetail>
export default meta
type Story = StoryObj<typeof meta>

export const Agent: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText("Example nightly job")).toBeVisible()
    await expect(canvas.getByText("失効")).toBeVisible()
    await expect(canvas.getByRole("link", { name: "アカウントを開く" })).toBeVisible()
    await expect(canvas.queryByRole("button", { name: "失効させる" })).toBeNull()
    await expect(canvas.queryByRole("button", { name: "発行する" })).toBeNull()
    await expect(canvas.queryByRole("button", { name: "変える" })).toBeNull()
  },
}
export const Human: Story = { args: { id: "00000000-0000-4000-8000-000000000401" } }
export const NotFound: Story = { args: { id: "missing" } }
export const Loading: Story = { parameters: { mockScenario: "slow" } }
export const Mobile: Story = { globals: { viewport: { value: "mobile1", isRotated: false } } }
