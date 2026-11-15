import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, within } from "storybook/test"
import { FeatureDisabled, FeatureGate } from "@/components/app/business-feature"

const meta = {
  title: "App/BusinessFeature",
  component: FeatureGate,
  args: {
    feature: "customer",
    name: "顧客",
    features: { kind: "ok", data: { disabled_features: [] } },
    children: <p>機能が有効なときの中身</p>,
  },
  decorators: [(Story) => <div className="w-96">{Story()}</div>],
} satisfies Meta<typeof FeatureGate>
export default meta
type Story = StoryObj<typeof meta>

export const Enabled: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText("機能が有効なときの中身")).toBeVisible()
  },
}
export const Disabled: Story = {
  args: { features: { kind: "ok", data: { disabled_features: ["customer"] } } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole("status")).toHaveTextContent("顧客の機能は有効になっていません")
    await expect(canvas.queryByText("機能が有効なときの中身")).toBeNull()
  },
}
export const Loading: Story = { args: { features: { kind: "loading" } } }
export const UnknownAvailability: Story = {
  args: { features: { kind: "error" } },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText("機能が有効なときの中身")).toBeVisible()
  },
}
export const Message: Story = { render: () => <FeatureDisabled name="業務の実行" /> }
export const Dark: Story = {
  args: { features: { kind: "ok", data: { disabled_features: ["customer"] } } },
  globals: { theme: "dark", backgrounds: { value: "dark" } },
}
