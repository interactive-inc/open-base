import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, within } from "storybook/test"
import AuditEvents from "@/pages/operations/audit/index"

const meta = {
  title: "Pages/Operations/Audit/List",
  component: AuditEvents,
  parameters: { layout: "fullscreen" },
  args: { email: "you@example.com", pathname: "/operations" },
} satisfies Meta<typeof AuditEvents>
export default meta
type Story = StoryObj<typeof meta>

export const Company: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText("employee.update")).toBeVisible()
    await expect(canvas.getByText(/拒否・失敗が 2 件あります/)).toBeVisible()
    await expect(canvas.getByRole("link", { name: "開示の方針" })).toBeVisible()
    await expect(canvas.queryByRole("link", { name: "書き出す" })).toBeNull()
  },
}
export const System: Story = {
  args: { ledger: "system" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText("system.connector.updated")).toBeVisible()
    // 記録の種類は同じ一覧の見方の切り替えなので、ラジオの並びになる。
    await expect(canvas.getByRole("radio", { name: "基盤の記録" })).toHaveAttribute(
      "aria-checked",
      "true",
    )
  },
}
export const OnlyDenied: Story = {
  args: {
    filters: { from: "", to: "", actor: "", action: "", outcome: "denied" },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText("organization.update")).toBeVisible()
    await expect(canvas.queryByText("employee.update")).toBeNull()
  },
}
export const ReversedRange: Story = {
  args: {
    filters: { from: "2026-11-10", to: "2026-11-01", actor: "", action: "", outcome: "" },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByRole("alert")).toHaveTextContent("期間の始まり")
  },
}
export const InvalidActor: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.type(
      await canvas.findByRole("textbox", { name: "操作した人（アカウントの番号）" }),
      "someone",
    )
    await userEvent.click(canvas.getByRole("button", { name: "絞り込む" }))
    await expect(await canvas.findByRole("alert")).toHaveTextContent("アカウントの番号")
  },
}
export const Empty: Story = { parameters: { mockScenario: "empty" } }
export const Forbidden: Story = { parameters: { mockScenario: "member" } }
export const Error: Story = { parameters: { mockScenario: "error" } }
export const Loading: Story = { parameters: { mockScenario: "slow" } }
export const Mobile: Story = { globals: { viewport: { value: "mobile1", isRotated: false } } }
