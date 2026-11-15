import type { Meta, StoryObj } from "@storybook/react-vite"
import { AuthFrame } from "@/components/app/auth-frame"
import { Button } from "@/components/ui/button"

const meta = {
  title: "App/AuthFrame",
  component: AuthFrame,
  parameters: { layout: "fullscreen" },
  args: {
    title: "サインイン",
    description: "組織のアカウントを使います。",
    children: <Button>続ける</Button>,
  },
} satisfies Meta<typeof AuthFrame>
export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = {}
export const Error: Story = { args: { error: "接続できませんでした。もう一度お試しください。" } }
export const WithFooter: Story = { args: { footer: "管理者にお問い合わせください。" } }
/** 判断の画面のように読む量が多いときの幅。 */
export const Wide: Story = { args: { width: "wide" } }
