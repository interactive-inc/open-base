import type { Meta, StoryObj } from "@storybook/react-vite"
import { NotificationMeta } from "@/components/app/notifications-meta"
import type { SystemNotification } from "@/components/app/notifications-model"

const NOTIFICATION: SystemNotification = {
  id: "example-delivery",
  message_id: "example-message",
  kind: "company:approval_request",
  title: "申請が届きました",
  body: null,
  source: null,
  action: null,
  resource_scope: null,
  priority: "normal",
  delivered_at: "2026-11-14T00:05:00.000Z",
  read_at: null,
}

const meta = {
  title: "App/NotificationMeta",
  component: NotificationMeta,
  args: { notification: NOTIFICATION },
  decorators: [(Story) => <div className="w-96">{Story()}</div>],
} satisfies Meta<typeof NotificationMeta>
export default meta
type Story = StoryObj<typeof meta>

export const Unread: Story = {}
export const Read: Story = {
  args: { notification: { ...NOTIFICATION, read_at: "2026-11-14T01:00:00.000Z" } },
}
export const Critical: Story = {
  args: { notification: { ...NOTIFICATION, priority: "critical", kind: "example:unknown" } },
}
export const Dark: Story = { globals: { theme: "dark", backgrounds: { value: "dark" } } }
