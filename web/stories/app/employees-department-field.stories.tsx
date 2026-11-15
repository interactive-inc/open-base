import type { Meta, StoryObj } from "@storybook/react-vite"
import { useState } from "react"
import { DepartmentField } from "@/components/app/employees-department-field"
import type { OrganizationUnit } from "@/components/app/employees-types"

const units: OrganizationUnit[] = [
  { id: "unit-dev", code: "DEV", name: "開発部", parent_code: null },
  { id: "unit-sales", code: "SALES", name: "営業部", parent_code: null },
]

const meta = {
  title: "App/Employees/DepartmentField",
  component: DepartmentField,
  args: {
    label: "部署",
    units: { kind: "ok", data: units },
    value: "",
    onChange: () => {},
  },
  render: (args) => {
    const [value, setValue] = useState(args.value)
    return <DepartmentField {...args} value={value} onChange={setValue} />
  },
  decorators: [(Story) => <div className="w-80">{Story()}</div>],
} satisfies Meta<typeof DepartmentField>
export default meta
type Story = StoryObj<typeof meta>

export const Choose: Story = {}
export const WithEmpty: Story = { args: { emptyLabel: "すべての部署" } }
export const Selected: Story = { args: { value: "SALES" } }
export const CodeInput: Story = {
  args: { units: { kind: "error" }, description: "部署のコードを入力してください。" },
}
export const Loading: Story = { args: { units: { kind: "loading" } } }
