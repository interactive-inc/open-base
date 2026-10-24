import type { Meta, StoryObj } from "@storybook/react-vite"
import { BatchJobTable } from "@/app/(app)/system/batches/_components/batch-job-table"

const meta = {
  title: "batch/BatchJobTable",
  component: BatchJobTable,
} satisfies Meta<typeof BatchJobTable>

export default meta

type Story = StoryObj<typeof meta>

export const WithJobs: Story = {
  args: {
    jobs: [
      {
        id: 1,
        name: "daily-attendance-close",
        status: "completed",
        started_at: "2026-06-10T23:00:00Z",
        finished_at: "2026-06-10T23:01:30Z",
        message: null,
      },
      {
        id: 2,
        name: "monthly-payroll-calc",
        status: "running",
        started_at: "2026-06-11T02:00:00Z",
        finished_at: null,
        message: null,
      },
      {
        id: 3,
        name: "notification-cleanup",
        status: "failed",
        started_at: "2026-06-10T04:00:00Z",
        finished_at: "2026-06-10T04:00:05Z",
        message: "Connection timeout",
      },
    ],
  },
}

export const AllCompleted: Story = {
  args: {
    jobs: [
      {
        id: 1,
        name: "daily-attendance-close",
        status: "completed",
        started_at: "2026-06-10T23:00:00Z",
        finished_at: "2026-06-10T23:01:30Z",
        message: "Processed 150 records",
      },
      {
        id: 2,
        name: "leave-balance-update",
        status: "completed",
        started_at: "2026-06-10T23:02:00Z",
        finished_at: "2026-06-10T23:02:10Z",
        message: null,
      },
    ],
  },
}
