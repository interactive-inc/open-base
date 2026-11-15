import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, within } from "storybook/test"
import { ProjectEfforts } from "@/components/app/business-efforts"

const meta = {
  title: "App/BusinessEfforts",
  component: ProjectEfforts,
  args: {
    projectId: "9a000000-0000-4000-8000-000000000001",
    employeeName: () => "Example Owner",
  },
  decorators: [(Story) => <div className="max-w-2xl">{Story()}</div>],
} satisfies Meta<typeof ProjectEfforts>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText("取消済み")).toBeVisible()
    await expect(canvas.getByRole("heading", { level: 2, name: "工数" })).toBeVisible()
    await expect(canvas.getByRole("columnheader", { name: "記録した人" })).toBeVisible()
    // 見るだけの部品なので、工数の記録と取消の操作は出さない。
    await expect(canvas.queryByRole("button")).toBeNull()
    await expect(canvas.queryByRole("form")).toBeNull()
  },
}
export const Empty: Story = {
  parameters: { mockScenario: "empty" },
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByText("CLI か MCP で工数を記録すると、ここに出ます。"),
    ).toBeVisible()
  },
}
export const Error: Story = { parameters: { mockScenario: "error" } }
