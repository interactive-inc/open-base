import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, within } from "storybook/test"
import { ProjectList } from "@/components/app/business-project-list"
import type { ProjectRecord } from "@/components/app/business-types"

function project(id: number, name: string, status: ProjectRecord["status"]): ProjectRecord {
  return {
    id: `9a000000-0000-4000-8000-00000000000${id}`,
    kind: "project",
    name,
    customer_id: "c0000000-0000-4000-8000-000000000001",
    offering_id: null,
    owner_employee_id: "10000000-0000-4000-8000-000000000001",
    description: "",
    status,
    starts_on: "2026-10-01",
    due_on: "2026-12-25",
    planned_minutes: 6000,
    remaining_minutes: 2400,
    created_by_employee_id: "10000000-0000-4000-8000-000000000001",
    reason: "作業の開始",
    baseline_minutes: 4800,
    actual_minutes: 1080,
    forecast_minutes: 3480,
    variance_minutes: -2520,
    revision: 1,
    recorded_at: "2026-10-01T01:00:00.000Z",
    request_id: "example-request-1",
    actor_account_id: "example-account",
  }
}

const meta = {
  title: "App/BusinessProjectList",
  component: ProjectList,
  args: {
    projects: [
      project(1, "生産管理の見直し", "active"),
      project(2, "保守の更新", "planned"),
      project(3, "店舗データの移行", "completed"),
      project(4, "とても長い名前の会員向けサービスの改修と移行の準備", "cancelled"),
    ],
    customerName: () => "Example Manufacturing",
    ownerName: () => "Example Owner",
  },
} satisfies Meta<typeof ProjectList>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole("list", { name: "生産管理の見直しの段階" })).toBeVisible()
    await expect(canvas.getAllByText(/Example Manufacturing/)[0]).toBeVisible()
  },
}
export const WithoutNames: Story = { args: { customerName: undefined, ownerName: undefined } }
export const Mobile: Story = { globals: { viewport: { value: "mobile1", isRotated: false } } }
