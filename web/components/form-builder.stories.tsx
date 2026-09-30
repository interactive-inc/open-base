import type { Meta, StoryObj } from "@storybook/react-vite"
import { FormBuilder } from "@/components/form-builder"

const meta = {
  title: "FormBuilder",
  component: FormBuilder,
} satisfies Meta<typeof FormBuilder>

export default meta

type Story = StoryObj<typeof meta>

export const Empty: Story = {
  args: {
    name: "form_schema",
  },
  render: (args) => (
    <div className="w-[560px]">
      <FormBuilder {...args} />
    </div>
  ),
}

export const WithFields: Story = {
  args: {
    name: "form_schema",
    initialSchema: {
      fields: [
        {
          id: "field_reason",
          label: "申請理由",
          type: "textarea",
          required: true,
          description: "経緯がわかるように書く",
          options: null,
        },
        {
          id: "field_date",
          label: "希望日",
          type: "date",
          required: true,
          description: null,
          options: null,
        },
        {
          id: "field_kind",
          label: "区分",
          type: "select",
          required: false,
          description: null,
          options: ["国内", "海外"],
        },
      ],
    },
  },
  render: (args) => (
    <div className="w-[560px]">
      <FormBuilder {...args} />
    </div>
  ),
}
