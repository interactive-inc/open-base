import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, screen, userEvent, within } from "storybook/test"
import AllApplications from "@/pages/applications/all"

const meta = {
  title: "Pages/Applications/All",
  component: AllApplications,
  parameters: { layout: "fullscreen" },
  args: { email: "you@example.com", pathname: "/applications" },
} satisfies Meta<typeof AllApplications>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText(/6 件のうち/)).toBeVisible()
    await expect(canvas.getByText("差し戻し")).toBeVisible()
  },
}
export const FilterByStatus: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await canvas.findByText(/6 件のうち/)
    await userEvent.click(canvas.getByRole("combobox", { name: "状態" }))
    await userEvent.click(await screen.findByRole("option", { name: "却下" }))
    await expect(await canvas.findByText(/1 件のうち/)).toBeVisible()
  },
}
export const Department: Story = {
  args: {
    filter: { scope: "department", status: null, template: null, department: null, offset: 0 },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(await canvas.findByRole("button", { name: "絞り込む" }))
    await expect(await canvas.findByRole("alert")).toHaveTextContent("部署のコード")
    await userEvent.type(canvas.getByLabelText("部署のコード"), "dev")
    await userEvent.click(canvas.getByRole("button", { name: "絞り込む" }))
    await expect(await canvas.findByText(/6 件のうち/)).toBeVisible()
  },
}
export const NoMatch: Story = {
  args: {
    filter: { scope: "department", status: null, template: null, department: "sales", offset: 0 },
  },
}
export const Forbidden: Story = { parameters: { mockScenario: "member" } }
export const Empty: Story = { parameters: { mockScenario: "empty" } }
export const Error: Story = { parameters: { mockScenario: "error" } }
export const Loading: Story = { parameters: { mockScenario: "slow" } }
export const Mobile: Story = { globals: { viewport: { value: "mobile1", isRotated: false } } }
