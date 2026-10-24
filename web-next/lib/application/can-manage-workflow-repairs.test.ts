import { describe, expect, test } from "vite-plus/test"
import { canManageWorkflowRepairs } from "@/lib/application/can-manage-workflow-repairs"

describe("canManageWorkflowRepairs", () => {
  test("requires both cross-company read and template management permissions", () => {
    expect(canManageWorkflowRepairs(["application:read:all", "application_template:manage"])).toBe(
      true,
    )
    expect(canManageWorkflowRepairs(["application:read:all"])).toBe(false)
    expect(canManageWorkflowRepairs(["application_template:manage"])).toBe(false)
    expect(canManageWorkflowRepairs([])).toBe(false)
  })
})
