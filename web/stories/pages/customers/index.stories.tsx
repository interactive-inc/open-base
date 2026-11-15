import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, within } from "storybook/test"
import Customers from "@/pages/customers/index"

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
  title: "Pages/Customers/List",
  component: Customers,
  parameters: { layout: "fullscreen" },
  args: { email: "you@example.com", pathname: "/customers" },
} satisfies Meta<typeof Customers>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText("Example Manufacturing")).toBeVisible()
    await expect((await canvas.findAllByText("進行中の案件 1"))[0]).toBeVisible()
    await expect(canvas.getByText("案件はまだありません")).toBeVisible()
    await expect(canvas.getByText("利用停止")).toBeVisible()
    await expect(canvas.queryByRole("button", { name: "顧客を登録する" })).toBeNull()
  },
}
export const Search: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.type(await canvas.findByLabelText("顧客を探す"), "shop")
    await expect(canvas.getByText("Example Retail")).toBeVisible()
    await expect(canvas.queryByText("Example Logistics")).toBeNull()
  },
}
export const Empty: Story = {
  parameters: { mockScenario: "empty" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      await canvas.findByText("CLI か MCP で顧客を登録すると、ここに出ます。"),
    ).toBeVisible()
    await expect(canvas.queryByRole("button", { name: "顧客を登録する" })).toBeNull()
  },
}
export const Error: Story = { parameters: { mockScenario: "error" } }
export const Loading: Story = { parameters: { mockScenario: "slow" } }
export const NoPermission: Story = {
  parameters: { mockScenario: "unlinked" },
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByText("表示する権限がありません。")).toBeVisible()
  },
}
export const Disabled: Story = {
  args: {
    initial: {
      profile,
      features: { kind: "ok", data: { disabled_features: ["customer"] } },
      customers: null,
      projects: null,
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText("顧客の機能は有効になっていません")).toBeVisible()
  },
}
export const Mobile: Story = { globals: { viewport: { value: "mobile1", isRotated: false } } }
