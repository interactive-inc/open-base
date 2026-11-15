import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, within } from "storybook/test"
import WorkRun from "@/pages/work/runs/[id]"

const meta = {
  title: "Pages/Work/Run",
  component: WorkRun,
  parameters: { layout: "fullscreen" },
  args: {
    email: "you@example.com",
    pathname: "/work",
    id: "a0000000-0000-4000-8000-000000000005",
    slug: "weekly-report",
  },
} satisfies Meta<typeof WorkRun>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      await canvas.findByRole("heading", { level: 1, name: "週次の報告書づくり" }),
    ).toBeVisible()
    await expect(canvas.getByText("あり（Example Assistant）")).toBeVisible()
    await expect(
      canvas.getByRole("link", { name: "9a000000-0000-4000-8000-000000000001" }),
    ).toHaveAttribute("href", "/projects/9a000000-0000-4000-8000-000000000001")
    // 見るだけの画面なので、訂正を記録する操作は出さない。
    await expect(canvas.queryByRole("button", { name: "訂正を記録する" })).toBeNull()
  },
}
export const Correction: Story = {
  args: { id: "a0000000-0000-4000-8000-000000000003" },
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByRole("link", { name: "以前の記録" }),
    ).toBeVisible()
  },
}
export const ByAgent: Story = {
  args: { id: "a0000000-0000-4000-8000-000000000004", slug: null },
}
export const NotFound: Story = {
  args: { id: "a0000000-0000-4000-8000-000000000099", slug: null },
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByText(
        "この実行の記録は見つかりません。一覧から選び直してください。",
      ),
    ).toBeVisible()
  },
}
export const Empty: Story = { parameters: { mockScenario: "empty" } }
export const Error: Story = { parameters: { mockScenario: "error" } }
export const Loading: Story = { parameters: { mockScenario: "slow" } }
export const Mobile: Story = { globals: { viewport: { value: "mobile1", isRotated: false } } }
