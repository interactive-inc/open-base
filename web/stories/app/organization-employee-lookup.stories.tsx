import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, fn, userEvent, within } from "storybook/test"
import { EmployeeLookup } from "@/components/app/organization-employee-lookup"

const meta = {
  title: "App/OrganizationEmployeeLookup",
  component: EmployeeLookup,
  args: { value: null, description: "番号は従業員の画面で確かめられます。", onSubmit: fn() },
  decorators: [(Story) => <div className="w-96">{Story()}</div>],
} satisfies Meta<typeof EmployeeLookup>
export default meta
type Story = StoryObj<typeof meta>

export const Empty: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole("button", { name: "表示する" }))
    await expect(await canvas.findByRole("alert")).toHaveTextContent("従業員番号を入れて")
    await expect(args.onSubmit).not.toHaveBeenCalled()
  },
}
export const Submit: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.type(canvas.getByLabelText("従業員番号"), "E001")
    await userEvent.click(canvas.getByRole("button", { name: "表示する" }))
    await expect(args.onSubmit).toHaveBeenCalledWith("E001")
  },
}
export const Filled: Story = { args: { value: "E001" } }
