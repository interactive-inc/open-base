import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, within } from "storybook/test"
import ApplicationTemplate from "@/pages/applications/templates/[code]"

const meta = {
  title: "Pages/Applications/Templates/Detail",
  component: ApplicationTemplate,
  parameters: { layout: "fullscreen" },
  args: { email: "you@example.com", pathname: "/applications", code: "leave" },
} satisfies Meta<typeof ApplicationTemplate>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByRole("heading", { name: "休暇の申請" })).toBeVisible()
    await expect(canvas.getByText("休む日")).toBeVisible()
    await expect(await canvas.findByText("申請者の直属の上長")).toBeVisible()
    await expect(canvas.getByText("責任 PEOPLE_MANAGER")).toBeVisible()
    await expect(canvas.queryByRole("button", { name: "変更を保存する" })).toBeNull()
    await expect(canvas.queryByRole("button", { name: "テンプレートを消す" })).toBeNull()
  },
}
export const NoWorkflow: Story = {
  args: { code: "purchase" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText(/承認ワークフローはまだありません/)).toBeVisible()
    await expect(canvas.getByText(/manager/)).toBeVisible()
  },
}
export const WorkflowForbidden: Story = { parameters: { mockScenario: "member" } }
export const NotFound: Story = { args: { code: "missing" } }
export const Error: Story = { parameters: { mockScenario: "error" } }
export const Loading: Story = { parameters: { mockScenario: "slow" } }
export const Mobile: Story = { globals: { viewport: { value: "mobile1", isRotated: false } } }
export const Empty: Story = { parameters: { mockScenario: "empty" } }
