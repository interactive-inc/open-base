import type { Meta, StoryObj } from "@storybook/react-vite"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const meta = {
  title: "ui/Select",
  component: Select,
} satisfies Meta<typeof Select>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <Select>
      <SelectTrigger className="w-[200px]">
        <SelectValue placeholder="部署を選択" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="sales">営業部</SelectItem>
        <SelectItem value="dev">開発部</SelectItem>
        <SelectItem value="hr">人事部</SelectItem>
        <SelectItem value="accounting">経理部</SelectItem>
      </SelectContent>
    </Select>
  ),
}

export const Small: Story = {
  render: () => (
    <Select>
      <SelectTrigger size="sm" className="w-[180px]">
        <SelectValue placeholder="選択" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="sales">営業部</SelectItem>
        <SelectItem value="dev">開発部</SelectItem>
        <SelectItem value="hr">人事部</SelectItem>
      </SelectContent>
    </Select>
  ),
}

export const WithGroups: Story = {
  render: () => (
    <Select>
      <SelectTrigger className="w-[220px]">
        <SelectValue placeholder="拠点・部署を選択" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>本社</SelectLabel>
          <SelectItem value="hq-sales">営業部</SelectItem>
          <SelectItem value="hq-dev">開発部</SelectItem>
          <SelectItem value="hq-hr">人事部</SelectItem>
        </SelectGroup>
        <SelectSeparator />
        <SelectGroup>
          <SelectLabel>支社</SelectLabel>
          <SelectItem value="okinawa">沖縄支店</SelectItem>
          <SelectItem value="tokyo">東京支店</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  ),
}

export const WithPlaceholder: Story = {
  render: () => (
    <Select>
      <SelectTrigger className="w-[200px]">
        <SelectValue placeholder="選択してください" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="option1">オプション 1</SelectItem>
        <SelectItem value="option2">オプション 2</SelectItem>
        <SelectItem value="option3">オプション 3</SelectItem>
      </SelectContent>
    </Select>
  ),
}

export const Disabled: Story = {
  render: () => (
    <Select disabled>
      <SelectTrigger className="w-[200px]">
        <SelectValue placeholder="選択不可" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="option1">オプション 1</SelectItem>
      </SelectContent>
    </Select>
  ),
}
