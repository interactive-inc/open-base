import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, within } from "storybook/test"
import Work from "@/pages/work/index"

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
  title: "Pages/Work/List",
  component: Work,
  parameters: { layout: "fullscreen" },
  args: { email: "you@example.com", pathname: "/work" },
} satisfies Meta<typeof Work>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect((await canvas.findAllByText("週次の報告書づくり"))[0]).toBeVisible()
    await expect(canvas.getByText("廃止")).toBeVisible()
    await expect(await canvas.findByText("要確認")).toBeVisible()
    await expect(await canvas.findByText("週次の報告書づくり（訂正）")).toBeVisible()
    // 見るだけの画面なので、業務の登録・変更と実行の記録の操作は出さない。絞り込みの選択だけは残る。
    const main = within(canvas.getByRole("main"))
    await expect(main.queryByRole("button", { name: /登録する|記録する|変更する/ })).toBeNull()
  },
}
export const Empty: Story = {
  parameters: { mockScenario: "empty" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      await canvas.findByText("CLI か MCP で業務を登録すると、ここに出ます。"),
    ).toBeVisible()
    await expect(
      await canvas.findByText("CLI か MCP で実行を記録すると、ここに出ます。"),
    ).toBeVisible()
  },
}
export const Error: Story = { parameters: { mockScenario: "error" } }
export const Loading: Story = { parameters: { mockScenario: "slow" } }
export const Disabled: Story = {
  args: {
    initial: {
      profile,
      features: { kind: "ok", data: { disabled_features: ["work-execution"] } },
      definitions: null,
      runs: null,
    },
  },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText("業務の実行の機能は有効になっていません"),
    ).toBeVisible()
  },
}
export const Mobile: Story = { globals: { viewport: { value: "mobile1", isRotated: false } } }
