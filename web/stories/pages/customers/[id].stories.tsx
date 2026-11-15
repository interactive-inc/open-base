import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, within } from "storybook/test"
import CustomerDetail from "@/pages/customers/[id]"

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
  title: "Pages/Customers/Detail",
  component: CustomerDetail,
  parameters: { layout: "fullscreen" },
  args: {
    email: "you@example.com",
    pathname: "/customers",
    id: "c0000000-0000-4000-8000-000000000001",
  },
} satisfies Meta<typeof CustomerDetail>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      await canvas.findByRole("heading", { level: 1, name: "Example Manufacturing" }),
    ).toBeVisible()
    await expect(await canvas.findByText("生産管理の見直し")).toBeVisible()
    await expect(await canvas.findByText("理由: 社名の変更")).toBeVisible()
    // 見るだけの画面なので、変更や案件の登録の操作は出さない。
    const main = within(canvas.getByRole("main"))
    await expect(main.queryByRole("button")).toBeNull()
    await expect(main.queryByRole("link", { name: "案件を登録する" })).toBeNull()
  },
}
export const WithoutProjects: Story = { args: { id: "c0000000-0000-4000-8000-000000000005" } }
export const Inactive: Story = { args: { id: "c0000000-0000-4000-8000-000000000004" } }
export const NotFound: Story = {
  args: { id: "c0000000-0000-4000-8000-000000000099" },
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByText(
        "この顧客は見つかりません。一覧から選び直してください。",
      ),
    ).toBeVisible()
  },
}
export const ProjectsDisabled: Story = {
  args: {
    initial: {
      profile,
      features: { kind: "ok", data: { disabled_features: ["client-project"] } },
      customer: null,
      projects: null,
    },
  },
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByText("案件の機能は有効になっていません"),
    ).toBeVisible()
  },
}
export const Empty: Story = { parameters: { mockScenario: "empty" } }
export const Error: Story = { parameters: { mockScenario: "error" } }
export const Loading: Story = { parameters: { mockScenario: "slow" } }
export const Mobile: Story = { globals: { viewport: { value: "mobile1", isRotated: false } } }
