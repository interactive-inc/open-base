import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, within } from "storybook/test"
import GradeAssignments from "@/pages/organization/grades/assignments"

const meta = {
  title: "Pages/Organization/GradeAssignments",
  component: GradeAssignments,
  parameters: { layout: "fullscreen" },
  args: {
    email: "you@example.com",
    pathname: "/organization",
    organizationId: "example-organization",
    employeeCode: "E001",
  },
} satisfies Meta<typeof GradeAssignments>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const now = await canvas.findByRole("region", { name: "今の等級" })
    await expect(await within(now).findByText("部長（G5）")).toBeVisible()
    const timeline = canvas.getByRole("region", { name: "割当の推移" })
    await expect(within(timeline).getByText("終了")).toBeVisible()
    const history = canvas.getByRole("region", { name: "記録の履歴" })
    await expect(await within(history).findByText("期間を変更")).toBeVisible()
  },
}
export const WithArchive: Story = {
  args: { employeeCode: "E003" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      await canvas.findByRole("region", { name: "旧台帳から保全した付与記録" }),
    ).toBeVisible()
  },
}
export const Lookup: Story = {
  args: { employeeCode: null },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.type(canvas.getByLabelText("従業員番号"), "E005")
    await userEvent.click(canvas.getByRole("button", { name: "表示する" }))
    await expect(await canvas.findByText("Example Engineer C")).toBeVisible()
  },
}
export const UnknownEmployee: Story = { args: { employeeCode: "E999" } }
export const NoEmployee: Story = { args: { employeeCode: null } }
export const Error: Story = { parameters: { mockScenario: "error" } }
export const Loading: Story = { parameters: { mockScenario: "slow" } }
export const Mobile: Story = { globals: { viewport: { value: "mobile1", isRotated: false } } }
