import type { Meta, StoryObj } from "@storybook/react-vite"
import { useState } from "react"
import { expect, userEvent, within } from "storybook/test"
import { AsOfPicker, ChangeMark, PeriodBadge } from "@/components/app/organization-period"

function Picker() {
  const [value, setValue] = useState("")
  return (
    <AsOfPicker
      value={value}
      today="2026-11-14"
      onChange={setValue}
      description="過去の日を選ぶと、その日の姿を表示します。"
    />
  )
}

const meta = {
  title: "App/OrganizationPeriod",
  component: PeriodBadge,
  args: { from: "2026-04-01", to: null, on: "2026-11-14" },
} satisfies Meta<typeof PeriodBadge>
export default meta
type Story = StoryObj<typeof meta>

export const Badges: Story = {
  render: () => (
    <div className="flex gap-2">
      <PeriodBadge from="2027-04-01" to={null} on="2026-11-14" />
      <PeriodBadge from="2026-04-01" to={null} on="2026-11-14" />
      <PeriodBadge from="2024-04-01" to="2025-04-01" on="2026-11-14" />
      <ChangeMark>今は無い</ChangeMark>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    for (const text of ["予約", "有効", "終了"]) await expect(canvas.getByText(text)).toBeVisible()
  },
}
export const AsOf: Story = {
  render: () => <Picker />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.type(canvas.getByLabelText("基準日"), "2026-01-01")
    await expect(await canvas.findByRole("status")).toHaveTextContent("2026年1月1日時点")
    await userEvent.click(canvas.getByRole("button", { name: "今の姿に戻す" }))
    await expect(canvas.queryByRole("status")).toBeNull()
  },
}
export const Dark: Story = {
  render: Badges.render,
  globals: { theme: "dark", backgrounds: { value: "dark" } },
}
