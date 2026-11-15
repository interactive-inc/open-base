import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, within } from "storybook/test"
import { AppShell } from "@/components/app/app-shell"

const meta = {
  title: "App/AppShell",
  component: AppShell,
  parameters: { layout: "fullscreen" },
  args: {
    email: "you@example.com",
    pathname: "/",
    name: "Example User",
    children: <h1 className="text-xl font-semibold">本文</h1>,
  },
} satisfies Meta<typeof AppShell>
export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = {}
/** 従業員と結び付いていない間は、メールアドレスを表示名にする。 */
export const Unlinked: Story = { args: { name: "you@example.com" } }
/** 領域の中の画面は、その領域を開いている間だけサイドバーの子項目に並ぶ。 */
export const InsideArea: Story = { args: { pathname: "/organization/grades/assignments" } }
/** サイドバーの下で配色を選ぶと、html の data-theme が切り替わる。システムを選ぶと固定を外す。 */
export const Theme: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const group = canvas.getByRole("radiogroup", { name: "配色" })
    await userEvent.click(within(group).getByRole("radio", { name: "ダーク" }))
    await expect(document.documentElement.dataset.theme).toBe("dark")
    await userEvent.click(within(group).getByRole("radio", { name: "システム" }))
    await expect(document.documentElement.dataset.theme).toBeUndefined()
  },
}
export const Mobile: Story = { globals: { viewport: { value: "mobile1", isRotated: false } } }
