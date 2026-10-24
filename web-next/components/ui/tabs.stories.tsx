import type { Meta, StoryObj } from "@storybook/react-vite"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"

const meta = {
  title: "ui/Tabs",
  component: Tabs,
} satisfies Meta<typeof Tabs>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <Tabs defaultValue="basic">
      <TabsList>
        <TabsTrigger value="basic">基本情報</TabsTrigger>
        <TabsTrigger value="attendance">勤怠</TabsTrigger>
        <TabsTrigger value="evaluation">評価</TabsTrigger>
      </TabsList>
      <TabsContent value="basic" className="mt-4">
        <p className="text-sm text-muted-foreground">
          従業員の基本情報（名前、部署、役職など）を表示します。
        </p>
      </TabsContent>
      <TabsContent value="attendance" className="mt-4">
        <p className="text-sm text-muted-foreground">
          勤怠記録（出勤時間、退勤時間、残業時間など）を表示します。
        </p>
      </TabsContent>
      <TabsContent value="evaluation" className="mt-4">
        <p className="text-sm text-muted-foreground">
          評価情報（目標達成度、スキル評価など）を表示します。
        </p>
      </TabsContent>
    </Tabs>
  ),
}

export const LineVariant: Story = {
  render: () => (
    <Tabs defaultValue="basic">
      <TabsList variant="line">
        <TabsTrigger value="basic">基本情報</TabsTrigger>
        <TabsTrigger value="attendance">勤怠</TabsTrigger>
        <TabsTrigger value="evaluation">評価</TabsTrigger>
      </TabsList>
      <TabsContent value="basic" className="mt-4">
        <p className="text-sm text-muted-foreground">基本情報タブの内容がここに表示されます。</p>
      </TabsContent>
      <TabsContent value="attendance" className="mt-4">
        <p className="text-sm text-muted-foreground">勤怠タブの内容がここに表示されます。</p>
      </TabsContent>
      <TabsContent value="evaluation" className="mt-4">
        <p className="text-sm text-muted-foreground">評価タブの内容がここに表示されます。</p>
      </TabsContent>
    </Tabs>
  ),
}

export const TwoTabs: Story = {
  render: () => (
    <Tabs defaultValue="active">
      <TabsList>
        <TabsTrigger value="active">有効</TabsTrigger>
        <TabsTrigger value="inactive">無効</TabsTrigger>
      </TabsList>
      <TabsContent value="active" className="mt-4">
        <p className="text-sm text-muted-foreground">有効な項目の一覧</p>
      </TabsContent>
      <TabsContent value="inactive" className="mt-4">
        <p className="text-sm text-muted-foreground">無効な項目の一覧</p>
      </TabsContent>
    </Tabs>
  ),
}
