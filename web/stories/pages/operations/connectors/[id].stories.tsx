import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, within } from "storybook/test"
import ConnectorPage from "@/pages/operations/connectors/[id]"

const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`

const meta = {
  title: "Pages/Operations/Connectors/Detail",
  component: ConnectorPage,
  parameters: { layout: "fullscreen" },
  args: { email: "you@example.com", pathname: "/operations", id: ID(101) },
} satisfies Meta<typeof ConnectorPage>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByRole("heading", { name: "Example 名簿の連携" })).toBeVisible()
    await expect(await canvas.findByText(/失敗したやり取りが 2 件あります/)).toBeVisible()
    await expect(canvas.queryByRole("button", { name: "もう一度試す" })).toBeNull()
    await expect(canvas.queryByRole("button", { name: "止める" })).toBeNull()
    await expect(canvas.queryByRole("button", { name: "名前を変える" })).toBeNull()
  },
}
export const Disabled: Story = {
  args: { id: ID(102) },
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByText(/この接続は止めています/)).toBeVisible()
  },
}
export const NotFound: Story = { args: { id: ID(999) } }
export const Forbidden: Story = { parameters: { mockScenario: "member" } }
export const Loading: Story = { parameters: { mockScenario: "slow" } }
export const Mobile: Story = { globals: { viewport: { value: "mobile1", isRotated: false } } }
