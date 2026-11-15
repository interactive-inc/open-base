import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, within } from "storybook/test"
import { PayloadList } from "@/components/app/applications-payload-list"

const meta = {
  title: "App/ApplicationsPayloadList",
  component: PayloadList,
  args: {
    payload: { date: "2026-11-20", kind: "有給休暇", reason: "私用のため\n午後から出社します" },
    labels: new Map([
      ["date", "休む日"],
      ["kind", "休みの種類"],
      ["reason", "理由"],
    ]),
  },
  decorators: [(Story) => <div className="w-96">{Story()}</div>],
} satisfies Meta<typeof PayloadList>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText("休む日")).toBeVisible()
    await expect(canvas.getByText("有給休暇")).toBeVisible()
  },
}
export const LabelsLoading: Story = {
  args: { labels: "loading" },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByText("date")).toBeNull()
  },
}
/** テンプレートを読めなかったときは、項目のキーをそのまま出す。 */
export const UnknownLabels: Story = { args: { labels: new Map() } }
export const Empty: Story = {
  args: { payload: {} },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText("入力された項目はありません。")).toBeVisible()
  },
}
export const Mobile: Story = { globals: { viewport: { value: "mobile1", isRotated: false } } }
export const Dark: Story = { globals: { theme: "dark", backgrounds: { value: "dark" } } }
