import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, within } from "storybook/test"
import Employees from "@/pages/employees/index"

const meta = {
  title: "Pages/Employees/List",
  component: Employees,
  parameters: { layout: "fullscreen" },
  args: { email: "you@example.com", pathname: "/employees" },
} satisfies Meta<typeof Employees>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText("Example Engineer")).toBeVisible()
    await expect(canvas.getByText("8人中 1〜8人目")).toBeVisible()
    await expect(canvas.getAllByText("休職中").length).toBeGreaterThan(0)
  },
}
export const Search: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await canvas.findByText("Example Engineer")
    await userEvent.type(canvas.getByRole("searchbox"), "Retiree")
    await userEvent.click(canvas.getByRole("button", { name: "探す" }))
    await expect(await canvas.findByText("1人中 1〜1人目")).toBeVisible()
    await expect(canvas.getByText("Example Retiree")).toBeVisible()
    await expect(canvas.queryByText("Example Engineer")).toBeNull()
  },
}
export const NoMatch: Story = {
  args: { filters: { q: "not-found", department: "", status: "", offset: 0 } },
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByText("条件に合う従業員がいません")).toBeVisible()
  },
}
export const Retired: Story = {
  args: { filters: { q: "", department: "", status: "retired", offset: 0 } },
}
export const Empty: Story = { parameters: { mockScenario: "empty" } }
export const Error: Story = { parameters: { mockScenario: "error" } }
export const Loading: Story = { parameters: { mockScenario: "slow" } }
export const Forbidden: Story = {
  parameters: { mockScenario: "member" },
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByText("表示する権限がありません。")).toBeVisible()
  },
}
export const Mobile: Story = { globals: { viewport: { value: "mobile1", isRotated: false } } }
