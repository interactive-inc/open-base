import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, screen, userEvent, within } from "storybook/test"
import ApplicationDecision from "@/pages/decisions/applications/[id]"

const meta = {
  title: "Pages/Decisions/Applications",
  component: ApplicationDecision,
  parameters: { layout: "fullscreen" },
  args: { email: "you@example.com", id: "101" },
} satisfies Meta<typeof ApplicationDecision>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByRole("heading", { name: "休暇の申請の判断" })).toBeVisible()
    await expect(await canvas.findByText("休む日")).toBeVisible()
    await expect(canvas.getByText("これまでの経過")).toBeVisible()
    await expect(canvas.getByRole("button", { name: "承認する" })).toBeEnabled()
  },
}
export const Approve: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(await canvas.findByRole("button", { name: "承認する" }))
    await expect(await canvas.findByRole("heading", { name: "承認しました" })).toBeVisible()
    await expect(canvas.getByRole("link", { name: "申請の詳細を見る" })).toBeVisible()
  },
}
export const RejectNeedsComment: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(await canvas.findByRole("button", { name: "却下する" }))
    await expect(await canvas.findByRole("alert")).toHaveTextContent("理由をコメントに")
    // 理由が無いうちは、確かめる画面も開かない。
    await expect(screen.queryByRole("alertdialog")).toBeNull()
  },
}
export const RejectCancelled: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.type(await canvas.findByLabelText("コメント"), "日程を見直してください")
    await userEvent.click(canvas.getByRole("button", { name: "却下する" }))
    const dialog = await screen.findByRole("alertdialog", { name: "この申請を却下しますか?" })
    await userEvent.click(within(dialog).getByRole("button", { name: "戻る" }))
    await expect(canvas.getByRole("button", { name: "承認する" })).toBeEnabled()
    await expect(canvas.queryByRole("heading", { name: "却下しました" })).toBeNull()
  },
}
export const Reject: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.type(await canvas.findByLabelText("コメント"), "日程を見直してください")
    await userEvent.click(canvas.getByRole("button", { name: "却下する" }))
    // 却下は取り消せないので、確かめてから送る。
    const dialog = await screen.findByRole("alertdialog", { name: "この申請を却下しますか?" })
    await userEvent.click(within(dialog).getByRole("button", { name: "却下を確定する" }))
    await expect(await canvas.findByRole("heading", { name: "却下しました" })).toBeVisible()
  },
}
export const LongApplicantName: Story = { args: { id: "102" } }
export const NotMyTurn: Story = {
  args: { id: "103" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      await canvas.findByRole("heading", { name: "この申請は判断できません" }),
    ).toBeVisible()
    await expect(canvas.queryByRole("button", { name: "承認する" })).toBeNull()
  },
}
export const AlreadyDecided: Story = {
  args: { id: "104" },
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByText("この申請はすでに却下されています。"),
    ).toBeVisible()
  },
}
export const NotFound: Story = { args: { id: "999" } }
export const Loading: Story = { parameters: { mockScenario: "slow" } }
export const Error: Story = { parameters: { mockScenario: "error" } }
export const Mobile: Story = { globals: { viewport: { value: "mobile1", isRotated: false } } }
export const Dark: Story = { globals: { theme: "dark", backgrounds: { value: "dark" } } }
