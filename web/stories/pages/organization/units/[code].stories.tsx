import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, within } from "storybook/test"
import OrganizationUnitPage from "@/pages/organization/units/[code]"

const meta = {
  title: "Pages/Organization/Unit",
  component: OrganizationUnitPage,
  parameters: { layout: "fullscreen" },
  args: {
    email: "you@example.com",
    pathname: "/organization",
    organizationId: "example-organization",
    code: "SALES",
  },
} satisfies Meta<typeof OrganizationUnitPage>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByRole("heading", { name: "営業部" })).toBeVisible()
    await expect(await canvas.findByText("Example Sales B")).toBeVisible()
    const history = canvas.getByRole("region", { name: "変更の履歴" })
    await expect(await within(history).findByText("名前を変更")).toBeVisible()
    await expect(within(history).getByText("最新の版")).toBeVisible()
  },
}
export const PastDate: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const past = await canvas.findByRole("region", { name: "過去の姿" })
    await userEvent.type(within(past).getByLabelText("基準日"), "2026-01-01")
    await expect(await within(past).findByText("販売部")).toBeVisible()
    await expect(within(past).getByText("変わった")).toBeVisible()
  },
}
export const NotFound: Story = { args: { code: "MISSING" } }
export const Error: Story = { parameters: { mockScenario: "error" } }
export const Loading: Story = { parameters: { mockScenario: "slow" } }
export const Mobile: Story = { globals: { viewport: { value: "mobile1", isRotated: false } } }
