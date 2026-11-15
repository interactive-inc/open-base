import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, within } from "storybook/test"
import AccountDetail from "@/pages/accounts/[id]"

const MEMBER = "00000000-0000-4000-8000-000000000002"
const SUSPENDED = "00000000-0000-4000-8000-000000000003"
const NEWCOMER = "00000000-0000-4000-8000-000000000004"

const meta = {
  title: "Pages/Accounts/Detail",
  component: AccountDetail,
  parameters: { layout: "fullscreen" },
  args: {
    email: "you@example.com",
    pathname: "/accounts",
    id: MEMBER,
    organizationId: "example-organization",
  },
} satisfies Meta<typeof AccountDetail>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByRole("heading", { name: "Example Member" })).toBeVisible()
    await expect(await canvas.findByText(/と結び付いています/)).toBeVisible()
    const roles = (await canvas.findByRole("heading", { name: "ロール" })).closest<HTMLElement>(
      '[data-slot="card"]',
    )
    if (roles === null) throw new globalThis.Error("ロールの欄がありません")
    await expect(await within(roles).findByText("従業員")).toBeVisible()
    // 見るだけの画面なので、操作のボタンもフォームも出さない。
    await expect(canvas.queryByRole("button", { name: "停止する" })).toBeNull()
    await expect(canvas.queryByRole("button", { name: "外す" })).toBeNull()
    await expect(canvas.queryByRole("button", { name: "失効させる" })).toBeNull()
  },
}
export const Suspended: Story = {
  args: { id: SUSPENDED },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText(/停止中です。サインインできず/)).toBeVisible()
  },
}
export const NotLinked: Story = {
  args: { id: NEWCOMER },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText("登録待ち")).toBeVisible()
    await expect(await canvas.findByText(/まだ従業員と結び付いていません/)).toBeVisible()
    await expect(canvas.getByText(/ロールが付いていません/)).toBeVisible()
  },
}
export const NotFound: Story = { args: { id: "00000000-0000-4000-8000-000000000999" } }
export const Forbidden: Story = { parameters: { mockScenario: "member" } }
export const Loading: Story = { parameters: { mockScenario: "slow" } }
export const Error: Story = { parameters: { mockScenario: "error" } }
export const Mobile: Story = { globals: { viewport: { value: "mobile1", isRotated: false } } }
export const Dark: Story = { globals: { theme: "dark", backgrounds: { value: "dark" } } }
