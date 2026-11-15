import type { ApiCommand } from "@/lib/command/types"

/** Companyの変更理由・資源ごとの版・移行や保全の証跡を読むコマンド。 */
export const companyHistoryCommands: Readonly<Record<string, ApiCommand>> = {
  changes: {
    summary: "会社版ごとの変更理由と証跡",
    method: "GET",
    path: "/company/changes",
    organization: "flag",
    query: {
      "resource-type": "resource_type",
      cursor: "cursor",
      "through-revision": "through_revision",
      limit: "limit",
    },
  },
  "resource-history": {
    summary: "一つの資源の全改訂",
    method: "GET",
    path: "/company/resource-history/:type/:id",
    organization: "flag",
    query: {
      "after-revision": "after_revision",
      "through-revision": "through_revision",
      limit: "limit",
    },
  },
  "grade-assignment-history": {
    summary: "従業員の等級割当の全改訂",
    method: "GET",
    path: "/company/grade-assignment-history",
    organization: "flag",
    query: {
      "employee-id": "employee_id",
      "organization-revision": "organization_revision",
      offset: "offset",
      limit: "limit",
    },
    requiredQuery: ["employee-id"],
  },
  "legacy-personnel-action-records": {
    summary: "移行前の人事発令の記録",
    method: "GET",
    path: "/company/legacy-personnel-action-records",
    organization: "flag",
    query: {
      id: "id",
      "organization-revision": "organization_revision",
      "effective-on": "effective_on",
      "as-of": "as_of",
    },
  },
  "definition-resource-adoptions": {
    summary: "定義の移行証跡",
    method: "GET",
    path: "/company/definition-resource-adoptions/:commandId",
  },
  "grade-award-archives": {
    summary: "等級付与の保全済み原記録",
    method: "GET",
    path: "/company/grade-award-archives/:commandId",
  },
  "grade-award-archives by-employee": {
    summary: "従業員ごとの等級付与の保全済み原記録",
    method: "GET",
    path: "/company/grade-award-archives/by-employee/:employeeId",
  },
}
