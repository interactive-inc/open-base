import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, expect, test } from "vite-plus/test"
import { EmployeeTable } from "@/app/(app)/company/employees/_components/employee-table"

afterEach(cleanup)

test("コード未設定の従業員に無効な詳細リンクを出さない", () => {
  render(
    <EmployeeTable
      employees={[
        {
          code: null,
          name: "未接続",
          deptName: null,
          position: null,
          email: "",
          status: "active",
        },
        {
          code: "E001",
          name: "接続済み",
          deptName: null,
          position: null,
          email: "",
          status: "active",
        },
      ]}
    />,
  )

  expect(screen.getByRole("cell", { name: "未設定" })).toBeTruthy()
  expect(screen.queryByRole("link", { name: "未設定" })).toBeNull()
  expect(screen.getByRole("link", { name: "E001" }).getAttribute("href")).toBe(
    "/company/employees/E001",
  )
})
