import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { accountCases } from "@/tests/cases/accounts"
import { applicationCases } from "@/tests/cases/applications"
import { attachmentCases, recordCases } from "@/tests/cases/attachments-records"
import { auditCases } from "@/tests/cases/audit"
import { companyAdminCases, companySelfCases } from "@/tests/cases/company-other"
import { companyRecordCases } from "@/tests/cases/company-records"
import { connectorCases } from "@/tests/cases/connectors"
import { iamCases } from "@/tests/cases/iam"
import { notificationCases } from "@/tests/cases/notifications"
import { workItemCases } from "@/tests/cases/work-items"
import { createMcpTestClient } from "@/tests/support/mcp-test-client"

/** 個別の試験を持つ既存のツール。 */
const coveredElsewhere = new Set([
  "application_templates_list",
  "application_requests_submit",
  "application_requests_mine",
  "application_requests_inbox",
  "application_requests_show",
  "attachments_upload",
  "foundation_request",
  "review_cycles_list",
  "review_cycles_show",
  "review_cycles_create",
  "review_sheets_list",
  "review_sheets_create",
  "review_sheets_show",
  "review_sheets_history",
  "review_sheets_command",
  "work_execution_record",
  "work_execution_definitions",
  "work_execution_save_definition",
  "work_execution_delete_definition",
  "work_execution_runs",
  "client_project_records",
  "client_project_save",
  "customer_records",
  "customer_save",
  "offering_records",
  "offering_save",
  "decision_url",
])

/** 書き込みのツールは明示の意図を求め、step-up が要るものは人がCLIで取ったトークンを受ける。 */
test("every MCP tool has a request case and states intent and step-up", async () => {
  const directory = await mkdtemp(join(tmpdir(), "base-mcp-coverage-"))
  const client = await createMcpTestClient({
    entry: resolve(import.meta.dir, "../index.ts"),
    baseUrl: "http://127.0.0.1:9",
    configDirectory: directory,
  })
  try {
    const { tools } = await client.listTools()
    const cases = [
      accountCases,
      applicationCases,
      attachmentCases,
      recordCases,
      auditCases,
      companyAdminCases,
      companySelfCases,
      companyRecordCases,
      connectorCases,
      iamCases,
      notificationCases,
      workItemCases,
    ].flat()
    const tested = new Set(cases.map((item) => item.tool))
    expect(
      tools
        .map((tool) => tool.name)
        .filter((name) => !coveredElsewhere.has(name) && !tested.has(name)),
    ).toEqual([])
    expect([...tested].filter((name) => !tools.some((tool) => tool.name === name))).toEqual([])
    for (const tool of tools.filter((tool) => !coveredElsewhere.has(tool.name))) {
      const writes = tool.annotations?.readOnlyHint !== true
      expect({
        name: tool.name,
        intent: writes && !tool.description?.includes("explicit user intent"),
      }).toEqual({
        name: tool.name,
        intent: false,
      })
      const stepUp = tool.inputSchema.required?.includes("step_up_token") === true
      expect({
        name: tool.name,
        stepUp: stepUp && !tool.description?.includes("base step-up"),
      }).toEqual({
        name: tool.name,
        stepUp: false,
      })
    }
  } finally {
    await client.close()
    await rm(directory, { recursive: true, force: true })
  }
}, 15_000)
