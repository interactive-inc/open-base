import type { Meta, StoryObj } from "@storybook/react-vite"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

const meta = {
  title: "ui/Dialog",
  component: Dialog,
} satisfies Meta<typeof Dialog>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger render={<Button />}>ダイアログを開く</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>確認</DialogTitle>
          <DialogDescription>この操作を続行しますか？</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>キャンセル</DialogClose>
          <Button>続行する</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
}

export const WithoutCloseButton: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger render={<Button />}>閉じるボタンなし</DialogTrigger>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>重要な確認</DialogTitle>
          <DialogDescription>この操作は取り消すことができません。続行しますか？</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>戻る</DialogClose>
          <Button>確認して続行</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
}

export const DeleteConfirmation: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger render={<Button variant="destructive" />}>従業員を削除</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>削除確認</DialogTitle>
          <DialogDescription>
            この従業員を削除しますか？この操作は取り消せません。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>キャンセル</DialogClose>
          <Button variant="destructive">削除する</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
}

export const FormDialog: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger render={<Button />}>従業員を追加</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>従業員の追加</DialogTitle>
          <DialogDescription>新しい従業員の情報を入力してください。</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label htmlFor="dialog-name" className="text-sm font-medium">
              名前
            </label>
            <Input id="dialog-name" placeholder="名前を入力" />
          </div>
          <div className="space-y-2">
            <label htmlFor="dialog-email" className="text-sm font-medium">
              メールアドレス
            </label>
            <Input id="dialog-email" type="email" placeholder="email@example.com" />
          </div>
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>キャンセル</DialogClose>
          <Button>追加する</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
}
