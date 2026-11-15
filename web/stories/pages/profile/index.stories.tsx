import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, within } from "storybook/test"
import MyProfile from "@/pages/profile/index"

const meta = {
  title: "Pages/Profile",
  component: MyProfile,
  parameters: { layout: "fullscreen" },
  args: { email: "you@example.com", pathname: "/profile" },
} satisfies Meta<typeof MyProfile>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText("000-0000-0001")).toBeVisible()
    await expect(await canvas.findByText("Example Corrected")).toBeVisible()
  },
}
export const NoReports: Story = {
  parameters: { mockScenario: "member" },
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByText("直属の部下はいません")).toBeVisible()
  },
}
export const Unlinked: Story = { parameters: { mockScenario: "unlinked" } }
export const Empty: Story = { parameters: { mockScenario: "empty" } }
export const Error: Story = { parameters: { mockScenario: "error" } }
export const Loading: Story = { parameters: { mockScenario: "slow" } }
export const Mobile: Story = { globals: { viewport: { value: "mobile1", isRotated: false } } }
