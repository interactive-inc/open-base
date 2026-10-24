import type { Meta, StoryObj } from "@storybook/react-vite"
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { Button } from "@/components/ui/button"
import { Settings, Plus } from "lucide-react"

const meta = {
  title: "ui/Tooltip",
  component: Tooltip,
  decorators: [
    (Story) => (
      <TooltipProvider>
        <Story />
      </TooltipProvider>
    ),
  ],
} satisfies Meta<typeof Tooltip>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <Tooltip>
      <TooltipTrigger render={<Button variant="outline" />}>ホバーしてください</TooltipTrigger>
      <TooltipContent>
        <p>ツールチップのテキスト</p>
      </TooltipContent>
    </Tooltip>
  ),
}

export const OnIconButton: Story = {
  render: () => (
    <Tooltip>
      <TooltipTrigger render={<Button variant="ghost" size="icon" />}>
        <Settings />
      </TooltipTrigger>
      <TooltipContent>
        <p>設定</p>
      </TooltipContent>
    </Tooltip>
  ),
}

export const LongText: Story = {
  render: () => (
    <Tooltip>
      <TooltipTrigger render={<Button variant="outline" />}>詳しい説明</TooltipTrigger>
      <TooltipContent>
        <p>この操作は取り消すことができません。実行前に内容をご確認ください。</p>
      </TooltipContent>
    </Tooltip>
  ),
}

export const MultipleTooltips: Story = {
  render: () => (
    <div className="flex gap-4">
      <Tooltip>
        <TooltipTrigger render={<Button variant="ghost" size="icon" />}>
          <Plus />
        </TooltipTrigger>
        <TooltipContent>
          <p>新規作成</p>
        </TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger render={<Button variant="ghost" size="icon" />}>
          <Settings />
        </TooltipTrigger>
        <TooltipContent>
          <p>設定</p>
        </TooltipContent>
      </Tooltip>
    </div>
  ),
}
