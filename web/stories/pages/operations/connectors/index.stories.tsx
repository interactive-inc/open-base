import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, within } from "storybook/test"
import Connectors from "@/pages/operations/connectors/index"

const meta = {
  title: "Pages/Operations/Connectors/List",
  component: Connectors,
  parameters: { layout: "fullscreen" },
  args: { email: "you@example.com", pathname: "/operations" },
} satisfies Meta<typeof Connectors>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const links = await canvas.findAllByRole("link", { name: /Example/ })
    // 止めている接続を先に並べる。状態の札は名前の下にあり、同じカードに入る。
    await expect(links[0]?.closest('[data-slot="card"]')).toHaveTextContent("停止中")
    await expect(canvas.queryByRole("link", { name: "登録する" })).toBeNull()
  },
}
export const Empty: Story = {
  parameters: { mockScenario: "empty" },
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByText("CLI か MCP で登録すると、ここに出ます。"),
    ).toBeVisible()
  },
}
export const Forbidden: Story = { parameters: { mockScenario: "member" } }
export const Error: Story = { parameters: { mockScenario: "error" } }
export const Loading: Story = { parameters: { mockScenario: "slow" } }
export const Mobile: Story = { globals: { viewport: { value: "mobile1", isRotated: false } } }
