import type { Meta, StoryObj } from "@storybook/react-vite"
import { InboxIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  BackLink,
  EmptyState,
  Loaded,
  PageHeader,
  RowsSkeleton,
  TextSkeleton,
  ViewSwitch,
} from "@/components/app/data-view"

const meta = {
  title: "App/DataView",
  component: PageHeader,
  args: { title: "承認", description: "あなたの判断を待っている申請がここに並びます。" },
  decorators: [(Story) => <div className="flex w-96 flex-col gap-4">{Story()}</div>],
} satisfies Meta<typeof PageHeader>
export default meta
type Story = StoryObj<typeof meta>

export const Header: Story = {}
/** 分類は名前の下、その画面全体に効く操作は右の端に置く。 */
export const HeaderWithBadgesAndAction: Story = {
  args: {
    badges: <Badge variant="secondary">承認待ち</Badge>,
    action: <Button variant="secondary">読み込み直す</Button>,
  },
}
export const Back: Story = { render: () => <BackLink href="/applications">申請へ戻る</BackLink> }
export const Switch: Story = {
  render: () => (
    <ViewSwitch
      label="通知の絞り込み"
      current="/notifications"
      items={[
        { href: "/notifications", label: "すべて" },
        { href: "/notifications?filter=unread", label: "未読" },
      ]}
    />
  ),
}
export const Empty: Story = {
  render: () => (
    <EmptyState
      icon={InboxIcon}
      title="判断を待っている申請はありません"
      description="届くとここに出ます。"
    />
  ),
}
export const LoadingRows: Story = { render: () => <RowsSkeleton /> }
export const LoadingText: Story = {
  render: () => (
    <p className="text-2xl font-semibold">
      <TextSkeleton label="読み込み中" placeholder="山田 太郎 さん" />
    </p>
  ),
}
export const Failed: Story = {
  render: () => <Loaded state={{ kind: "error" }}>{() => null}</Loaded>,
}
export const Forbidden: Story = {
  render: () => <Loaded state={{ kind: "forbidden" }}>{() => null}</Loaded>,
}
