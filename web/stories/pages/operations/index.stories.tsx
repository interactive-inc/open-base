import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, within } from "storybook/test"
import OperationsOverview from "@/pages/operations/index"

const meta = {
  title: "Pages/Operations/Overview",
  component: OperationsOverview,
  parameters: { layout: "fullscreen" },
  args: { email: "you@example.com", pathname: "/operations" },
} satisfies Meta<typeof OperationsOverview>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      await canvas.findByText("止まっているものがあります。上から順に確かめてください。"),
    ).toBeVisible()
    await expect(await canvas.findByText("応答あり")).toBeVisible()
    await expect(await canvas.findByText("3 件")).toBeVisible()
    await expect(canvas.getByText("example-optional-app")).toBeVisible()
    const areas = canvas.getByRole("navigation", { name: "運用と監査の機能" })
    await expect(within(areas).getAllByRole("link")).toHaveLength(4)
  },
}
export const NothingToFix: Story = {
  parameters: { mockScenario: "empty" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText("止まっているものはありません。")).toBeVisible()
  },
}
export const Forbidden: Story = {
  parameters: { mockScenario: "member" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect((await canvas.findAllByText("見る権限がありません")).length).toBeGreaterThan(0)
  },
}
export const Error: Story = { parameters: { mockScenario: "error" } }
export const Loading: Story = { parameters: { mockScenario: "slow" } }
export const Mobile: Story = { globals: { viewport: { value: "mobile1", isRotated: false } } }
export const Dark: Story = { globals: { theme: "dark", backgrounds: { value: "dark" } } }
