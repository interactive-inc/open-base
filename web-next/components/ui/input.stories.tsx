import type { Meta, StoryObj } from "@storybook/react-vite"
import { Input } from "@/components/ui/input"

const meta = {
  title: "ui/Input",
  component: Input,
} satisfies Meta<typeof Input>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: { placeholder: "入力してください" },
}

export const WithValue: Story = {
  args: { defaultValue: "山田太郎" },
}

export const Password: Story = {
  args: { type: "password", placeholder: "パスワードを入力" },
}

export const Email: Story = {
  args: { type: "email", placeholder: "email@example.com" },
}

export const Disabled: Story = {
  args: { disabled: true, defaultValue: "編集不可", placeholder: "入力してください" },
}

export const WithLabel: Story = {
  render: () => (
    <div className="space-y-2">
      <label htmlFor="name-input" className="text-sm font-medium">
        名前
      </label>
      <Input id="name-input" placeholder="名前を入力してください" />
    </div>
  ),
}

export const File: Story = {
  args: { type: "file" },
}

export const AllTypes: Story = {
  render: () => (
    <div className="space-y-4 max-w-sm">
      <div className="space-y-2">
        <label className="text-sm font-medium">テキスト</label>
        <Input placeholder="テキスト入力" />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">メールアドレス</label>
        <Input type="email" placeholder="email@example.com" />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">パスワード</label>
        <Input type="password" placeholder="パスワード" />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">数値</label>
        <Input type="number" placeholder="0" />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">日付</label>
        <Input type="date" />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">ファイル</label>
        <Input type="file" />
      </div>
    </div>
  ),
}
