import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, within } from "storybook/test"
import ProjectDetail from "@/pages/projects/[id]"

const meta = {
  title: "Pages/Projects/Detail",
  component: ProjectDetail,
  parameters: { layout: "fullscreen" },
  args: {
    email: "you@example.com",
    pathname: "/projects",
    id: "9a000000-0000-4000-8000-000000000001",
  },
} satisfies Meta<typeof ProjectDetail>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      await canvas.findByRole("heading", { level: 1, name: "生産管理の見直し" }),
    ).toBeVisible()
    await expect(canvas.getByRole("list", { name: "案件の段階" })).toBeVisible()
    // 実績18時間と残り40時間で、予定100時間より42時間余る見込み。
    await expect(canvas.getByText("18時間")).toBeVisible()
    await expect(canvas.getByText("42時間 余る見込み")).toBeVisible()
    await expect(await canvas.findByText("取消済み")).toBeVisible()
    // 見るだけの画面なので、状態の変更、工数の記録・取消、内容の変更の操作は出さない。
    const main = within(canvas.getByRole("main"))
    await expect(main.queryByRole("button")).toBeNull()
    await expect(main.queryByRole("form")).toBeNull()
  },
}
export const Planned: Story = { args: { id: "9a000000-0000-4000-8000-000000000002" } }
export const Cancelled: Story = {
  args: { id: "9a000000-0000-4000-8000-000000000005" },
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByText("中止 · この案件は止まっています"),
    ).toBeVisible()
  },
}
export const NotFound: Story = { args: { id: "9a000000-0000-4000-8000-000000000099" } }
export const Empty: Story = { parameters: { mockScenario: "empty" } }
export const Error: Story = { parameters: { mockScenario: "error" } }
export const Loading: Story = { parameters: { mockScenario: "slow" } }
export const Mobile: Story = { globals: { viewport: { value: "mobile1", isRotated: false } } }
