import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, within } from "storybook/test"
import OrganizationChart from "@/pages/organization/index"

const meta = {
  title: "Pages/Organization/Chart",
  component: OrganizationChart,
  parameters: { layout: "fullscreen" },
  args: {
    email: "you@example.com",
    pathname: "/organization",
    organizationId: "example-organization",
  },
} satisfies Meta<typeof OrganizationChart>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const tree = await canvas.findByRole("tree", { name: "組織図" })
    await expect(within(tree).getByText("営業部")).toBeVisible()
    await expect(await canvas.findByText("開発部（主務）")).toBeVisible()
  },
}
export const SelectUnit: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const tree = await canvas.findByRole("tree", { name: "組織図" })
    await userEvent.click(within(tree).getByText("基盤チーム"))
    await expect(await canvas.findByRole("heading", { name: "基盤チーム" })).toBeVisible()
    await expect(await canvas.findByText("Example Engineer A")).toBeVisible()
    await expect(canvas.getByRole("link", { name: "詳しく見る" })).toHaveAttribute(
      "href",
      "/organization/units/DEV-PLATFORM",
    )
  },
}
export const PastDate: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await canvas.findByRole("tree", { name: "組織図" })
    await userEvent.type(canvas.getByLabelText("基準日"), "2026-01-01")
    const tree = await canvas.findByRole("tree", { name: "基準日の組織図" })
    await expect(within(tree).getByText("販売部")).toBeVisible()
    await expect(within(tree).getByText("今は「営業部」")).toBeVisible()
    await expect(within(tree).getByText("今は無い")).toBeVisible()
    await expect(within(tree).getByText("今は別の上位組織")).toBeVisible()
    await expect(canvas.getByRole("status")).toHaveTextContent("2026年1月1日時点")
    await expect(canvas.getByText(/NEW-BIZ/)).toBeVisible()
  },
}
export const Empty: Story = { parameters: { mockScenario: "empty" } }
export const Error: Story = { parameters: { mockScenario: "error" } }
export const Loading: Story = { parameters: { mockScenario: "slow" } }
export const Mobile: Story = { globals: { viewport: { value: "mobile1", isRotated: false } } }
export const Dark: Story = { globals: { theme: "dark", backgrounds: { value: "dark" } } }
