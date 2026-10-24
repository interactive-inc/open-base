import type { Meta, StoryObj } from "@storybook/react-vite"
import { Alert, AlertTitle, AlertDescription, AlertAction } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { CircleAlert, Info, CheckCircle2 } from "lucide-react"

const meta = {
  title: "ui/Alert",
  component: Alert,
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "destructive"],
    },
  },
} satisfies Meta<typeof Alert>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <Alert>
      <AlertTitle>お知らせ</AlertTitle>
      <AlertDescription>新しい機能が追加されました。</AlertDescription>
    </Alert>
  ),
}

export const Destructive: Story = {
  render: () => (
    <Alert variant="destructive">
      <AlertTitle>エラー</AlertTitle>
      <AlertDescription>データの保存に失敗しました。再度お試しください。</AlertDescription>
    </Alert>
  ),
}

export const WithAction: Story = {
  render: () => (
    <Alert>
      <AlertTitle>更新があります</AlertTitle>
      <AlertDescription>システムの更新が利用可能です。</AlertDescription>
      <AlertAction>
        <Button size="sm">更新する</Button>
      </AlertAction>
    </Alert>
  ),
}

export const InfoAlert: Story = {
  render: () => (
    <Alert>
      <Info className="h-4 w-4" />
      <AlertTitle>ヒント</AlertTitle>
      <AlertDescription>Ctrl + S でいつでも保存できます。</AlertDescription>
    </Alert>
  ),
}

export const SuccessAlert: Story = {
  render: () => (
    <Alert>
      <CheckCircle2 className="h-4 w-4" />
      <AlertTitle>成功</AlertTitle>
      <AlertDescription>従業員の情報が正常に保存されました。</AlertDescription>
    </Alert>
  ),
}

export const ErrorWithIcon: Story = {
  render: () => (
    <Alert variant="destructive">
      <CircleAlert className="h-4 w-4" />
      <AlertTitle>入力エラー</AlertTitle>
      <AlertDescription>
        必須項目が入力されていません。赤枠のフィールドを確認してください。
      </AlertDescription>
    </Alert>
  ),
}

export const AllVariants: Story = {
  render: () => (
    <div className="space-y-4">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>情報</AlertTitle>
        <AlertDescription>これは情報アラートです。</AlertDescription>
      </Alert>
      <Alert variant="destructive">
        <CircleAlert className="h-4 w-4" />
        <AlertTitle>エラー</AlertTitle>
        <AlertDescription>これはエラーアラートです。</AlertDescription>
      </Alert>
    </div>
  ),
}
