import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, within } from "storybook/test"
import AuditEventDetail from "@/pages/operations/audit/[id]"

const meta = {
  title: "Pages/Operations/Audit/Detail",
  component: AuditEventDetail,
  parameters: { layout: "fullscreen" },
  args: { email: "you@example.com", pathname: "/operations", id: "company-event-1" },
} satisfies Meta<typeof AuditEventDetail>
export default meta
type Story = StoryObj<typeof meta>

export const Company: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByRole("heading", { name: "employee.update" })).toBeVisible()
    await expect(canvas.getByRole("heading", { name: "変更後の値" })).toBeVisible()
  },
}
export const SystemRedacted: Story = {
  args: { id: "00000000-0000-4000-8000-000000000602", ledger: "system" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText(/開示の方針により/)).toHaveTextContent("操作した人")
  },
}
export const NotFound: Story = { args: { id: "missing-event" } }
export const Error: Story = { parameters: { mockScenario: "error" } }
export const Loading: Story = { parameters: { mockScenario: "slow" } }
export const Mobile: Story = { globals: { viewport: { value: "mobile1", isRotated: false } } }
