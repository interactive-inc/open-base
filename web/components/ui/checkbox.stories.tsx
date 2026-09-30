import type { Meta, StoryObj } from "@storybook/react-vite"
import { Checkbox } from "@/components/ui/checkbox"

const meta = {
  title: "ui/Checkbox",
  component: Checkbox,
} satisfies Meta<typeof Checkbox>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Checked: Story = {
  args: { defaultChecked: true },
}

export const Disabled: Story = {
  args: { disabled: true },
}

export const DisabledChecked: Story = {
  args: { disabled: true, defaultChecked: true },
}

export const WithLabel: Story = {
  render: () => (
    <label className="flex items-center gap-2 cursor-pointer">
      <Checkbox />
      <span className="text-sm">利用規約に同意する</span>
    </label>
  ),
}

export const CheckboxGroup: Story = {
  render: () => (
    <div className="space-y-3">
      <p className="text-sm font-medium">好きな果物を選んでください</p>
      <div className="space-y-2">
        {["りんご", "みかん", "バナナ", "ぶどう", "いちご"].map((fruit) => (
          <label key={fruit} className="flex items-center gap-2 cursor-pointer">
            <Checkbox />
            <span className="text-sm">{fruit}</span>
          </label>
        ))}
      </div>
    </div>
  ),
}
