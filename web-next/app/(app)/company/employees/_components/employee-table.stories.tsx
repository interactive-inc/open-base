import type { Meta, StoryObj } from "@storybook/react-vite"
import { EmployeeTable } from "@/app/(app)/company/employees/_components/employee-table"

const meta = {
  title: "employees/EmployeeTable",
  component: EmployeeTable,
} satisfies Meta<typeof EmployeeTable>

export default meta

type Story = StoryObj<typeof meta>

export const WithEmployees: Story = {
  args: {
    employees: [
      {
        code: "EMP001",
        name: "Taro Yamada",
        deptName: "Engineering",
        position: "Senior Engineer",
        email: "taro@example.com",
        status: "active",
      },
      {
        code: "EMP002",
        name: "Hanako Sato",
        deptName: "Human Resources",
        position: "Manager",
        email: "hanako@example.com",
        status: "active",
      },
      {
        code: "EMP003",
        name: "Jiro Tanaka",
        deptName: null,
        position: null,
        email: "jiro@example.com",
        status: "leave",
      },
      {
        code: "EMP004",
        name: "Yuki Suzuki",
        deptName: "Sales",
        position: "Director",
        email: "yuki@example.com",
        status: "retired",
      },
    ],
  },
}

export const Empty: Story = {
  args: {
    employees: [],
  },
}
