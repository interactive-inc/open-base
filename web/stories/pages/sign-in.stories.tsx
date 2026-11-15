import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, within, userEvent } from "storybook/test"
import SignIn from "@/pages/sign-in"

const meta = {
  title: "Pages/SignIn",
  component: SignIn,
  parameters: { layout: "fullscreen" },
  args: { next: "/", method: "passkey", error: null },
} satisfies Meta<typeof SignIn>
export default meta
type Story = StoryObj<typeof meta>

export const Passkey: Story = {}
export const Password: Story = {
  args: { method: "password" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.type(canvas.getByLabelText("メールアドレス"), "you@example.com")
    await userEvent.type(canvas.getByLabelText("パスワード"), "example-preview-password")
    await expect(canvas.getByLabelText("パスワード")).toHaveAttribute("type", "password")
    await expect(canvas.getByRole("button", { name: /^サインイン$/ })).toBeEnabled()
  },
}
export const Oidc: Story = { args: { method: "oidc" } }
export const InvalidConfiguration: Story = { args: { method: null } }
export const Cancelled: Story = { args: { error: "サインインが取り消されました。" } }
export const LongError: Story = {
  args: {
    error:
      "組織のアカウントに接続できませんでした。時間を置いて再試行するか、管理者に確認してください。",
  },
}
export const Mobile: Story = { globals: { viewport: { value: "mobile1", isRotated: false } } }
