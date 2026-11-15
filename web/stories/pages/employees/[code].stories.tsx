import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, within } from "storybook/test"
import EmployeeDetail from "@/pages/employees/[code]"

const meta = {
  title: "Pages/Employees/Detail",
  component: EmployeeDetail,
  parameters: { layout: "fullscreen" },
  args: { email: "you@example.com", pathname: "/employees", code: "E0003", asOf: "2026-11-14" },
} satisfies Meta<typeof EmployeeDetail>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByRole("heading", { name: "Example Engineer" })).toBeVisible()
    await expect(await canvas.findByText("いまここ")).toBeVisible()
    await expect(canvas.getByText("予定")).toBeVisible()
    const state = within(await canvas.findByRole("region", { name: /の状態$/ }))
    await expect(await state.findByText("開発部")).toBeVisible()
  },
}
export const PastDate: Story = {
  args: { asOf: "2020-01-01" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText("2020年1月1日の状態")).toBeVisible()
    const state = within(canvas.getByRole("region", { name: "2020年1月1日の状態" }))
    await expect(await state.findByText("営業部")).toBeVisible()
  },
}
export const Corrected: Story = {
  args: { code: "E0007" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText("訂正済み")).toBeVisible()
    await expect(canvas.getByText("「異動」に訂正 · 発令日 2024-10-01")).toBeVisible()
  },
}
export const OnLeave: Story = { args: { code: "E0004" } }
export const Retired: Story = { args: { code: "E0005" } }
export const ConcurrentAssignment: Story = { args: { code: "E0006" } }
export const NotFound: Story = {
  args: { code: "E9999" },
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByText("表示する権限がありません。")).toBeVisible()
  },
}
export const Empty: Story = { parameters: { mockScenario: "empty" } }
export const Error: Story = { parameters: { mockScenario: "error" } }
export const Loading: Story = { parameters: { mockScenario: "slow" } }
export const Mobile: Story = { globals: { viewport: { value: "mobile1", isRotated: false } } }
export const Dark: Story = { globals: { theme: "dark", backgrounds: { value: "dark" } } }
