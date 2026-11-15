import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, within } from "storybook/test"
import Grades from "@/pages/organization/grades/index"

const meta = {
  title: "Pages/Organization/Grades",
  component: Grades,
  parameters: { layout: "fullscreen" },
  args: {
    email: "you@example.com",
    pathname: "/organization",
    organizationId: "example-organization",
  },
} satisfies Meta<typeof Grades>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText("係長・専門職")).toBeVisible()
    await expect(canvas.getByText("上級専門職")).toBeVisible()
    await expect(canvas.getByText("予約")).toBeVisible()
    await expect(canvas.queryByText("見習い")).toBeNull()
  },
}
export const PastDate: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await canvas.findByText("上級専門職")
    await userEvent.type(canvas.getByLabelText("基準日"), "2026-01-01")
    await expect(await canvas.findByText(/2026年1月1日時点/)).toBeVisible()
    await expect(canvas.queryByText("上級専門職")).toBeNull()
  },
}
export const Empty: Story = { parameters: { mockScenario: "empty" } }
export const Error: Story = { parameters: { mockScenario: "error" } }
export const Loading: Story = { parameters: { mockScenario: "slow" } }
export const Mobile: Story = { globals: { viewport: { value: "mobile1", isRotated: false } } }
