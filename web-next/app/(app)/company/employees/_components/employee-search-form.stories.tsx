import type { Meta, StoryObj } from "@storybook/react-vite"
import { EmployeeSearchForm } from "@/app/(app)/company/employees/_components/employee-search-form"

const meta = {
  title: "employees/EmployeeSearchForm",
  component: EmployeeSearchForm,
} satisfies Meta<typeof EmployeeSearchForm>

export default meta

type Story = StoryObj<typeof meta>

export const Empty: Story = {
  args: {
    filter: {
      q: null,
      dept: null,
      status: null,
    },
  },
}

export const WithFilters: Story = {
  args: {
    filter: {
      q: "yamada",
      dept: "Engineering",
      status: "active",
    },
  },
}
