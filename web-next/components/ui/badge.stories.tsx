import type { Meta, StoryObj } from "@storybook/react-vite"
import { Badge } from "@/components/ui/badge"

const meta = {
  title: "ui/Badge",
  component: Badge,
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "secondary", "destructive", "outline", "ghost", "link"],
    },
  },
} satisfies Meta<typeof Badge>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: { children: "有効", variant: "default" },
}

export const Secondary: Story = {
  args: { children: "申請中", variant: "secondary" },
}

export const Destructive: Story = {
  args: { children: "却下", variant: "destructive" },
}

export const Outline: Story = {
  args: { children: "下書き", variant: "outline" },
}

export const Ghost: Story = {
  args: { children: "補足", variant: "ghost" },
}

export const Link: Story = {
  args: { children: "フィルタ", variant: "link" },
}

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Badge variant="default">承認済み</Badge>
      <Badge variant="secondary">申請中</Badge>
      <Badge variant="destructive">却下</Badge>
      <Badge variant="outline">下書き</Badge>
      <Badge variant="ghost">補足</Badge>
      <Badge variant="link">フィルタ</Badge>
    </div>
  ),
}

export const WithCustomContent: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Badge>✅ 完了</Badge>
      <Badge variant="destructive">🚨 エラー</Badge>
      <Badge variant="secondary">⏳ 処理中</Badge>
    </div>
  ),
}

export const StatusMapping: Story = {
  render: () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">承認済み・完了・有効</p>
        <div className="flex gap-2">
          <Badge variant="default">承認済み</Badge>
          <Badge variant="default">出勤中</Badge>
          <Badge variant="default">有効</Badge>
        </div>
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">申請中・レビュー中・処理中</p>
        <div className="flex gap-2">
          <Badge variant="secondary">休暇申請中</Badge>
          <Badge variant="secondary">経費申請中</Badge>
          <Badge variant="secondary">レビュー中</Badge>
        </div>
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">却下・失効・エラー</p>
        <div className="flex gap-2">
          <Badge variant="destructive">申請却下</Badge>
          <Badge variant="destructive">期限切れ</Badge>
          <Badge variant="destructive">無効</Badge>
        </div>
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">下書き・未提出</p>
        <div className="flex gap-2">
          <Badge variant="outline">下書き</Badge>
          <Badge variant="outline">未提出</Badge>
        </div>
      </div>
    </div>
  ),
}
