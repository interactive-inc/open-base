import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, within } from "storybook/test"
import Offerings from "@/pages/offerings/index"

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
  title: "Pages/Offerings/List",
  component: Offerings,
  parameters: { layout: "fullscreen" },
  args: { email: "you@example.com", pathname: "/offerings" },
} satisfies Meta<typeof Offerings>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText("Example Consulting")).toBeVisible()
    await expect(canvas.getByText("利用停止")).toBeVisible()
    // 見るだけの画面なので、登録と変更の操作は出さない。
    await expect(within(canvas.getByRole("main")).queryByRole("button")).toBeNull()
  },
}
export const Empty: Story = {
  parameters: { mockScenario: "empty" },
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByText("CLI か MCP でサービスを登録すると、ここに出ます。"),
    ).toBeVisible()
  },
}
export const Error: Story = { parameters: { mockScenario: "error" } }
export const Loading: Story = { parameters: { mockScenario: "slow" } }
export const Disabled: Story = {
  args: {
    initial: {
      profile,
      features: { kind: "ok", data: { disabled_features: ["offering"] } },
      offerings: null,
    },
  },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText("サービスの機能は有効になっていません"),
    ).toBeVisible()
  },
}
export const Mobile: Story = { globals: { viewport: { value: "mobile1", isRotated: false } } }
