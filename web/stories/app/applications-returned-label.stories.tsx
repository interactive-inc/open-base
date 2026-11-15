import type { Meta, StoryObj } from "@storybook/react-vite"
import { ReturnedLabel } from "@/components/app/applications-returned-label"
import { ApplicationStatusLabel } from "@/components/app/phase-bar"

const meta = {
  title: "App/ApplicationsReturnedLabel",
  component: ReturnedLabel,
} satisfies Meta<typeof ReturnedLabel>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const WithStatus: Story = {
  render: () => (
    <span className="flex gap-2">
      <ReturnedLabel />
      <ApplicationStatusLabel status="pending" />
    </span>
  ),
}
export const Dark: Story = { globals: { theme: "dark", backgrounds: { value: "dark" } } }
