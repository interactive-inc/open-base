import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, within } from "storybook/test"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Facts } from "@/components/app/operations-view"

const meta = {
  title: "App/OperationsView",
  component: Facts,
  args: {
    items: [
      ["理由", "remote.rejected"],
      ["試した回数", "5 回"],
      ["流し直した日時", null],
    ],
  },
  decorators: [
    (Story) => (
      <Card className="w-[36rem] max-w-full">
        <CardHeader>
          <CardTitle>
            <h2>記録の内容</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>{Story()}</CardContent>
      </Card>
    ),
  ],
} satisfies Meta<typeof Facts>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText("remote.rejected")).toBeVisible()
    // 値の無い項目は空にせず「なし」と出す。
    await expect(canvas.getByText("なし")).toBeVisible()
  },
}
export const LongValue: Story = {
  args: {
    items: [
      ["記録の番号", "00000000-0000-4000-8000-000000000602"],
      ["対象", "example:connector 00000000-0000-4000-8000-000000000101"],
    ],
  },
}
export const Mobile: Story = { globals: { viewport: { value: "mobile1", isRotated: false } } }
export const Dark: Story = { globals: { theme: "dark", backgrounds: { value: "dark" } } }
