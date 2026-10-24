import type { Meta, StoryObj } from "@storybook/react-vite"
import { OrgTreeNodeItem } from "@/app/(app)/company/departments/_components/org-tree-node-item"

const meta = {
  title: "org/OrgTreeNodeItem",
  component: OrgTreeNodeItem,
  decorators: [
    (Story) => (
      <ul className="flex flex-col gap-1">
        <Story />
      </ul>
    ),
  ],
} satisfies Meta<typeof OrgTreeNodeItem>

export default meta

type Story = StoryObj<typeof meta>

export const LeafNode: Story = {
  args: {
    depth: 0,
    node: {
      code: "D001",
      name: "Engineering",
      manager_employee_code: "EMP001",
      member_count: 12,
      children: [],
    },
  },
}

export const WithChildren: Story = {
  args: {
    depth: 0,
    node: {
      code: "D000",
      name: "Product Division",
      manager_employee_code: "EMP010",
      member_count: 30,
      children: [
        {
          code: "D001",
          name: "Engineering",
          manager_employee_code: "EMP001",
          member_count: 12,
          children: [
            {
              code: "D001-1",
              name: "Frontend",
              manager_employee_code: null,
              member_count: 5,
              children: [],
            },
            {
              code: "D001-2",
              name: "Backend",
              manager_employee_code: "EMP005",
              member_count: 7,
              children: [],
            },
          ],
        },
        {
          code: "D002",
          name: "Design",
          manager_employee_code: null,
          member_count: 4,
          children: [],
        },
      ],
    },
  },
}

export const NoManager: Story = {
  args: {
    depth: 1,
    node: {
      code: "D003",
      name: "New Department",
      manager_employee_code: null,
      member_count: 0,
      children: [],
    },
  },
}
