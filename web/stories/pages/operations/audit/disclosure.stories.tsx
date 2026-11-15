import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, within } from "storybook/test"
import AuditDisclosure from "@/pages/operations/audit/disclosure"

const meta = {
  title: "Pages/Operations/Audit/Disclosure",
  component: AuditDisclosure,
  parameters: { layout: "fullscreen" },
  args: { email: "you@example.com", pathname: "/operations" },
} satisfies Meta<typeof AuditDisclosure>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      await canvas.findByRole("heading", { name: "いまの方針（第 2 版）" }),
    ).toBeVisible()
    await expect(canvas.getByText("操作した人、対象の番号、理由")).toBeVisible()
    await expect(canvas.queryByRole("button", { name: "新しい版を公開する" })).toBeNull()
  },
}
export const OneAccount: Story = {
  args: { scope: "00000000-0000-4000-8000-000000000002" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText(/この範囲の方針はまだ公開されていません。/)).toBeVisible()
  },
}
export const Forbidden: Story = { parameters: { mockScenario: "member" } }
export const Error: Story = { parameters: { mockScenario: "error" } }
export const Loading: Story = { parameters: { mockScenario: "slow" } }
export const Mobile: Story = { globals: { viewport: { value: "mobile1", isRotated: false } } }
