import type { Meta, StoryObj } from "@storybook/react-vite"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardContent,
  CardFooter,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Pencil } from "lucide-react"

const meta = {
  title: "ui/Card",
  component: Card,
  argTypes: {
    size: {
      control: "select",
      options: ["default", "sm"],
    },
  },
} satisfies Meta<typeof Card>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <Card className="w-[380px]">
      <CardHeader>
        <CardTitle>従業員情報</CardTitle>
        <CardDescription>基本的な従業員情報を表示します</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">名前</span>
            <span>山田 太郎</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">部署</span>
            <span>開発部</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">役職</span>
            <span>エンジニア</span>
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <Button variant="outline" size="sm">
          詳細を見る
        </Button>
      </CardFooter>
    </Card>
  ),
}

export const SmallSize: Story = {
  render: () => (
    <Card size="sm" className="w-[320px]">
      <CardHeader>
        <CardTitle>お知らせ</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">新しいお知らせはありません</p>
      </CardContent>
    </Card>
  ),
}

export const WithAction: Story = {
  render: () => (
    <Card className="w-[380px]">
      <CardHeader>
        <div>
          <CardTitle>プロフィール</CardTitle>
          <CardDescription>従業員のプロフィール情報</CardDescription>
        </div>
        <CardAction>
          <Button variant="ghost" size="icon-sm">
            <Pencil />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <p className="text-sm">山田 太郎 — 開発部</p>
      </CardContent>
    </Card>
  ),
}

export const ContentOnly: Story = {
  render: () => (
    <Card className="w-[380px]">
      <CardContent className="pt-6">
        <p className="text-sm text-muted-foreground">
          シンプルなカードコンテンツのみの表示です。ヘッダーやフッターは省略できます。
        </p>
      </CardContent>
    </Card>
  ),
}

export const CardGrid: Story = {
  render: () => (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle>従業員数</CardTitle>
          <CardDescription>現在の従業員数</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">128</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>有給残日数</CardTitle>
          <CardDescription>平均残日数</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">12.5</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>申請待ち</CardTitle>
          <CardDescription>未処理の申請</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">7</p>
        </CardContent>
      </Card>
    </div>
  ),
}
