import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, within } from "storybook/test"
import { LifecycleTimeline } from "@/components/app/employees-timeline"
import type { LifecycleEvent } from "@/components/app/employees-types"

const event = (
  id: string,
  kind: LifecycleEvent["kind"],
  eventOn: string,
  status: LifecycleEvent["display_status"],
  summary: Partial<LifecycleEvent["summary"]> = {},
): LifecycleEvent => ({
  id,
  kind,
  event_on: eventOn,
  recorded_at: `${eventOn}T00:00:00.000Z`,
  source_type: "direct",
  source_application_id: null,
  corrects_action_id: null,
  display_status: status,
  summary: { kind, eventOn, ...summary },
})

const events: LifecycleEvent[] = [
  event("e5", "transferred", "2026-12-01", "scheduled", {
    department: { code: "NEW", name: "新規事業室" },
    positionTitle: "主任",
  }),
  event("e4", "position_changed", "2024-04-01", "confirmed", {
    department: { code: "DEV", name: "開発部" },
    previousPositionTitle: "担当",
    positionTitle: "主任",
    changeType: "promotion",
  }),
  event("e3", "corrected", "2021-10-01", "correction", {
    replacementKind: "transferred",
    replacementEventOn: "2021-10-01",
  }),
  event("e2", "transferred", "2021-10-01", "corrected", {
    department: { code: "SALES", name: "営業部" },
  }),
  event("e1", "hire", "2018-04-01", "confirmed", {
    department: { code: "SALES", name: "営業部" },
    positionTitle: "担当",
    employmentType: "FULL_TIME",
  }),
]

const meta = {
  title: "App/Employees/Timeline",
  component: LifecycleTimeline,
  args: {
    events,
    asOf: "2026-11-14",
    label: "人事発令の履歴",
  },
  decorators: [(Story) => <div className="w-[36rem] max-w-full">{Story()}</div>],
} satisfies Meta<typeof LifecycleTimeline>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText("いまここ")).toBeVisible()
    await expect(canvas.getByText("予定")).toBeVisible()
  },
}
export const PastDate: Story = { args: { asOf: "2019-01-01" } }
export const Single: Story = { args: { events: events.slice(4) } }
export const Dark: Story = { globals: { theme: "dark", backgrounds: { value: "dark" } } }
