import type { Meta, StoryObj } from "@storybook/react-vite"
import { useState } from "react"
import { ChoiceField } from "@/components/app/employees-choice-field"

const meta = {
  title: "App/Employees/ChoiceField",
  component: ChoiceField,
  args: {
    label: "状態",
    choices: [
      { value: "all", label: "すべて" },
      { value: "active", label: "在籍" },
      { value: "retired", label: "退職" },
    ],
    value: "",
    onChange: () => {},
  },
  render: (args) => {
    const [value, setValue] = useState(args.value)
    return <ChoiceField {...args} value={value} onChange={setValue} />
  },
  decorators: [(Story) => <div className="w-80">{Story()}</div>],
} satisfies Meta<typeof ChoiceField>
export default meta
type Story = StoryObj<typeof meta>

export const Empty: Story = {}
export const Selected: Story = { args: { value: "retired" } }
