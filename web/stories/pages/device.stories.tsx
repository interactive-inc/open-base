import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, within, userEvent } from "storybook/test"
import Device from "@/pages/device"

const meta = {
  title: "Pages/Device",
  component: Device,
  parameters: { layout: "fullscreen" },
  args: { userCode: "DEMO-CODE", method: "passkey", freshlySignedIn: true },
} satisfies Meta<typeof Device>
export default meta
type Story = StoryObj<typeof meta>
export const Confirm: Story = {}
export const EmptyCode: Story = { args: { userCode: null } }
export const PasswordReauthentication: Story = {
  args: { method: "password", freshlySignedIn: false },
}
export const OidcReauthentication: Story = { args: { method: "oidc", freshlySignedIn: false } }
export const InvalidConfiguration: Story = { args: { method: null } }
export const Approved: Story = {
  args: { method: "password" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole("button", { name: /承認/ }))
    await expect(await canvas.findByRole("heading", { name: "承認しました" })).toBeVisible()
  },
}
export const Denied: Story = {
  args: { method: "password" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole("button", { name: "拒否" }))
    await expect(await canvas.findByRole("heading", { name: "拒否しました" })).toBeVisible()
  },
}
