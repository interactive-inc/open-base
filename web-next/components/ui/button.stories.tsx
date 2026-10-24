import type { Meta, StoryObj } from "@storybook/react-vite"
import { Button } from "@/components/ui/button"
import { Plus, Pencil, Trash2, Settings } from "lucide-react"

const meta = {
  title: "ui/Button",
  component: Button,
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "outline", "secondary", "ghost", "destructive", "link"],
    },
    size: {
      control: "select",
      options: ["xs", "sm", "default", "lg", "icon", "icon-xs", "icon-sm", "icon-lg"],
    },
  },
} satisfies Meta<typeof Button>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: { children: "Button", variant: "default", size: "default" },
}

export const Outline: Story = {
  args: { children: "Outline", variant: "outline" },
}

export const Secondary: Story = {
  args: { children: "Secondary", variant: "secondary" },
}

export const Ghost: Story = {
  args: { children: "Ghost", variant: "ghost" },
}

export const Destructive: Story = {
  args: { children: "Destructive", variant: "destructive" },
}

export const Link: Story = {
  args: { children: "Link", variant: "link" },
}

export const SizeXs: Story = {
  args: { children: "XS", size: "xs" },
}

export const SizeSm: Story = {
  args: { children: "SM", size: "sm" },
}

export const SizeLg: Story = {
  args: { children: "LG", size: "lg" },
}

export const IconOnly: Story = {
  args: { size: "icon", children: <Plus /> },
}

export const IconXs: Story = {
  args: { size: "icon-xs", children: <Settings /> },
}

export const IconSm: Story = {
  args: { size: "icon-sm", children: <Pencil /> },
}

export const IconLg: Story = {
  args: { size: "icon-lg", children: <Trash2 /> },
}

export const Disabled: Story = {
  args: { children: "Disabled", disabled: true },
}

export const WithIconStart: Story = {
  args: {
    children: (
      <>
        <Plus data-icon="inline-start" />
        新規作成
      </>
    ),
  },
}

export const WithIconEnd: Story = {
  args: {
    children: (
      <>
        設定
        <Settings data-icon="inline-end" />
      </>
    ),
  },
}

export const AllVariants: Story = {
  decorators: [
    (Story) => (
      <div className="flex flex-wrap items-center gap-4">
        <Story />
      </div>
    ),
  ],
  render: () => (
    <>
      <Button variant="default">Default</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="destructive">Destructive</Button>
      <Button variant="link">Link</Button>
    </>
  ),
}

export const AllSizes: Story = {
  decorators: [
    (Story) => (
      <div className="flex flex-wrap items-end gap-4">
        <Story />
      </div>
    ),
  ],
  render: () => (
    <>
      <Button size="xs">XS</Button>
      <Button size="sm">SM</Button>
      <Button size="default">Default</Button>
      <Button size="lg">LG</Button>
      <Button size="icon-xs">
        <Plus />
      </Button>
      <Button size="icon-sm">
        <Plus />
      </Button>
      <Button size="icon">
        <Plus />
      </Button>
      <Button size="icon-lg">
        <Plus />
      </Button>
    </>
  ),
}

export const VariantSizeMatrix: Story = {
  decorators: [
    (Story) => (
      <div className="space-y-6">
        <Story />
      </div>
    ),
  ],
  render: () => {
    const variants = ["default", "outline", "secondary", "ghost", "destructive", "link"] as const
    const sizes = ["xs", "sm", "default", "lg"] as const
    return (
      <>
        {variants.map((variant) => (
          <div key={variant} className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">{variant}</p>
            <div className="flex flex-wrap items-end gap-3">
              {sizes.map((size) => (
                <Button key={size} variant={variant} size={size}>
                  {size}
                </Button>
              ))}
            </div>
          </div>
        ))}
      </>
    )
  },
}
