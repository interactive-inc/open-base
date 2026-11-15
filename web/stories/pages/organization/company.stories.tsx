import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, within } from "storybook/test"
import CompanyProfilePage from "@/pages/organization/company"

const meta = {
  title: "Pages/Organization/Company",
  component: CompanyProfilePage,
  parameters: { layout: "fullscreen" },
  args: { email: "you@example.com", pathname: "/organization" },
} satisfies Meta<typeof CompanyProfilePage>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const now = await canvas.findByRole("region", { name: "今の版" })
    await expect(within(now).getByText("Example 株式会社")).toBeVisible()
    await expect(within(now).getByText("4月")).toBeVisible()
  },
}
export const NotConfigured: Story = { parameters: { mockScenario: "empty" } }
export const Error: Story = { parameters: { mockScenario: "error" } }
export const Loading: Story = { parameters: { mockScenario: "slow" } }
export const Mobile: Story = { globals: { viewport: { value: "mobile1", isRotated: false } } }
