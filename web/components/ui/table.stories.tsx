import type { Meta, StoryObj } from "@storybook/react-vite"
import {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

const meta = {
  title: "ui/Table",
  component: Table,
} satisfies Meta<typeof Table>

export default meta

type Story = StoryObj<typeof meta>

const employees = [
  { name: "山田 太郎", department: "開発部", role: "エンジニア", status: "出勤中" },
  { name: "佐藤 花子", department: "営業部", role: "マネージャー", status: "出勤中" },
  { name: "田中 一郎", department: "人事部", role: "担当者", status: "休暇中" },
  { name: "鈴木 美咲", department: "経理部", role: "主任", status: "出勤中" },
  { name: "高橋 健太", department: "開発部", role: "リードエンジニア", status: "リモート" },
]

export const Default: Story = {
  render: () => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>名前</TableHead>
          <TableHead>部署</TableHead>
          <TableHead>役職</TableHead>
          <TableHead>ステータス</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {employees.map((emp) => (
          <TableRow key={emp.name}>
            <TableCell className="font-medium">{emp.name}</TableCell>
            <TableCell>{emp.department}</TableCell>
            <TableCell>{emp.role}</TableCell>
            <TableCell>
              <Badge variant={emp.status === "休暇中" ? "secondary" : "default"}>
                {emp.status}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  ),
}

export const WithCaption: Story = {
  render: () => (
    <Table>
      <TableCaption>2026年7月の従業員一覧</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>名前</TableHead>
          <TableHead>部署</TableHead>
          <TableHead>役職</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {employees.slice(0, 3).map((emp) => (
          <TableRow key={emp.name}>
            <TableCell className="font-medium">{emp.name}</TableCell>
            <TableCell>{emp.department}</TableCell>
            <TableCell>{emp.role}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  ),
}

export const WithFooter: Story = {
  render: () => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>部署</TableHead>
          <TableHead className="text-right">人数</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell>開発部</TableCell>
          <TableCell className="text-right">45</TableCell>
        </TableRow>
        <TableRow>
          <TableCell>営業部</TableCell>
          <TableCell className="text-right">32</TableCell>
        </TableRow>
        <TableRow>
          <TableCell>人事部</TableCell>
          <TableCell className="text-right">12</TableCell>
        </TableRow>
        <TableRow>
          <TableCell>経理部</TableCell>
          <TableCell className="text-right">8</TableCell>
        </TableRow>
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell>合計</TableCell>
          <TableCell className="text-right">97</TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  ),
}

export const Empty: Story = {
  render: () => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>名前</TableHead>
          <TableHead>部署</TableHead>
          <TableHead>役職</TableHead>
          <TableHead>ステータス</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
            データがありません
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  ),
}
