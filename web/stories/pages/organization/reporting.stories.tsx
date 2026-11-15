import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, screen, userEvent, within } from "storybook/test"
import Reporting from "@/pages/organization/reporting"

const meta = {
  title: "Pages/Organization/Reporting",
  component: Reporting,
  parameters: { layout: "fullscreen" },
  args: {
    email: "you@example.com",
    pathname: "/organization",
    organizationId: "example-organization",
    employeeCode: "E005",
  },
} satisfies Meta<typeof Reporting>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText("Example Engineer C")).toBeVisible()
    await expect(canvas.getByText("直属の上長")).toBeVisible()
    await expect(canvas.getByText("Example Engineer B")).toBeVisible()
    await expect(canvas.getByText("3段上の上長")).toBeVisible()
  },
}
export const Resolve: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const section = await canvas.findByRole("region", { name: "判断資格の確認" })
    await userEvent.click(await within(section).findByRole("combobox", { name: "責務" }))
    await userEvent.click(
      await screen.findByRole("option", { name: "経費の承認（expense-approval）" }),
    )
    await userEvent.click(within(section).getByRole("combobox", { name: "範囲の組織単位" }))
    await userEvent.click(await screen.findByRole("option", { name: "アプリチーム（DEV-APP）" }))
    await userEvent.click(within(section).getByRole("button", { name: "判断できる人を求める" }))
    const result = await canvas.findByRole("region", { name: "判断できる人" })
    await expect(within(result).getByText("従業員 employee-004")).toBeVisible()
  },
}
export const SubjectExcluded: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const section = await canvas.findByRole("region", { name: "判断資格の確認" })
    await userEvent.click(await within(section).findByRole("combobox", { name: "責務" }))
    await userEvent.click(
      await screen.findByRole("option", { name: "人事の承認（personnel-approval）" }),
    )
    await userEvent.type(within(section).getByLabelText("判断される人の従業員ID"), "employee-010")
    await userEvent.click(within(section).getByRole("button", { name: "判断できる人を求める" }))
    const result = await canvas.findByRole("region", { name: "判断できる人" })
    await expect(within(result).getByText(/判断できる人はいません/)).toBeVisible()
    await expect(within(result).getByText(/employee-010/)).toBeVisible()
  },
}
export const NoEmployee: Story = { args: { employeeCode: null } }
export const Empty: Story = { args: { employeeCode: null }, parameters: { mockScenario: "empty" } }
export const Error: Story = { parameters: { mockScenario: "error" } }
export const Loading: Story = { parameters: { mockScenario: "slow" } }
export const Mobile: Story = { globals: { viewport: { value: "mobile1", isRotated: false } } }
