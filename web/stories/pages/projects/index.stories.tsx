import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, within } from "storybook/test"
import Projects from "@/pages/projects/index"

const profile = {
  kind: "ok",
  data: {
    name: "Example Administrator",
    email: "you@example.com",
    dept_name: "開発部",
    position: "管理者",
    permissions: [],
  },
} as const

const meta = {
  title: "Pages/Projects/List",
  component: Projects,
  parameters: { layout: "fullscreen" },
  args: { email: "you@example.com", pathname: "/projects" },
} satisfies Meta<typeof Projects>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText("生産管理の見直し")).toBeVisible()
    // 状態の絞り込みは一つの選択にまとめ、件数は選択肢の名前で見せる。
    await expect(canvas.getByRole("combobox", { name: "状態で絞り込む" })).toHaveTextContent(
      "すべて 6件",
    )
    await expect(canvas.getByRole("list", { name: "生産管理の見直しの段階" })).toBeVisible()
    await expect(canvas.queryByRole("link", { name: "案件を登録する" })).toBeNull()
  },
}
export const FilterCompleted: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(await canvas.findByRole("combobox", { name: "状態で絞り込む" }))
    await userEvent.click(await canvas.findByRole("option", { name: "完了 2件" }))
    await expect(canvas.getByText("店舗データの移行")).toBeVisible()
    await expect(canvas.queryByText("生産管理の見直し")).toBeNull()
  },
}
export const Empty: Story = {
  parameters: { mockScenario: "empty" },
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByText("CLI か MCP で案件を登録すると、ここに出ます。"),
    ).toBeVisible()
  },
}
export const Error: Story = { parameters: { mockScenario: "error" } }
export const Loading: Story = { parameters: { mockScenario: "slow" } }
export const Disabled: Story = {
  args: {
    initial: {
      profile,
      features: { kind: "ok", data: { disabled_features: ["client-project"] } },
      projects: null,
      customers: null,
    },
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText("案件の機能は有効になっていません")).toBeVisible()
  },
}
export const Mobile: Story = { globals: { viewport: { value: "mobile1", isRotated: false } } }
