import { ids } from "@/tests/cases/ids"
import type { ToolCase } from "@/tests/support/tool-cases"

const organization = { "x-company-organization-id": ids.organization }
const command = {
  organization_id: ids.organization,
  expected_revision: 7,
  idempotency_key: "company-command-1",
}
const commandHeaders = { ...organization, "if-match": "7", "idempotency-key": "company-command-1" }
const resource = (type: string, attributes: Record<string, unknown>) => ({
  organizationId: ids.organization,
  type,
  id: `${type}-1`,
  revision: 1,
  state: "active",
  effectiveFrom: "2026-11-01",
  effectiveTo: null,
  attributes,
})
const evidence = [{ context: "company", kind: "document", id: "doc-1", version: "1" }]

function saveCase(tool: string, path: string, type: string, attributes: Record<string, unknown>) {
  const resources = [resource(type, attributes)]
  return {
    tool,
    args: { ...command, reason: "Register", resources },
    method: "POST",
    path,
    headers: commandHeaders,
    body: { reason: "Register", resources },
  } satisfies ToolCase
}

function listCase(tool: string, path: string) {
  return {
    tool,
    args: {
      organization_id: ids.organization,
      organization_revision: 7,
      effective_on: "2026-11-01",
    },
    method: "GET",
    path,
    query: { organization_revision: "7", effective_on: "2026-11-01" },
    headers: organization,
  } satisfies ToolCase
}

export const companyRecordCases: ReadonlyArray<ToolCase> = [
  listCase("company_employees_list", "/company/employees"),
  saveCase("company_employees_save", "/company/employees", "employee", { personId: "person-1" }),
  listCase("company_people_list", "/company/people"),
  saveCase("company_people_save", "/company/people", "person", { officialName: "Example Person" }),
  {
    ...listCase("company_employments_list", "/company/employments"),
    args: { organization_id: ids.organization, employee_id: "employee-1", include_ended: true },
    query: { employee_id: "employee-1", include_ended: "true" },
  },
  saveCase("company_employments_save", "/company/employments", "employment", {
    employeeId: "employee-1",
    status: "ACTIVE",
    employmentType: "FULL_TIME",
  }),
  listCase("company_profile_list", "/company/profile"),
  {
    ...saveCase("company_profile_save", "/company/profile", "company-profile", {
      displayName: "Example",
      locale: "en-US",
      timeZone: "UTC",
      fiscalYearStartMonth: 4,
    }),
    args: {
      ...command,
      reason: "Register",
      evidenceReferences: evidence,
      resources: [
        resource("company-profile", {
          displayName: "Example",
          locale: "en-US",
          timeZone: "UTC",
          fiscalYearStartMonth: 4,
        }),
      ],
    },
    body: {
      reason: "Register",
      evidenceReferences: evidence,
      resources: [
        resource("company-profile", {
          displayName: "Example",
          locale: "en-US",
          timeZone: "UTC",
          fiscalYearStartMonth: 4,
        }),
      ],
    },
  },
  {
    ...listCase("company_definitions_list", "/company/definitions"),
    args: { organization_id: ids.organization, type: "grade", id: "grade-1" },
    query: { id: "grade-1", type: "grade" },
  },
  saveCase("company_definitions_save", "/company/definitions", "grade", {
    code: "G1",
    officialName: "Grade 1",
  }),
  listCase("organization_snapshots_list", "/company/organization-snapshots"),
  {
    ...saveCase(
      "organization_changes_create",
      "/company/organization-changes",
      "organization-unit",
      {
        code: "UNIT",
      },
    ),
    args: {
      ...command,
      reason: "Register",
      corrections: [{ type: "organization-unit", id: "unit-1", revision: 2, correctsRevision: 1 }],
      resources: [resource("organization-unit", { code: "UNIT" })],
    },
    body: {
      reason: "Register",
      corrections: [{ type: "organization-unit", id: "unit-1", revision: 2, correctsRevision: 1 }],
      resources: [resource("organization-unit", { code: "UNIT" })],
    },
  },
  {
    tool: "employment_start_corrections_list",
    args: { organization_id: ids.organization, employment_id: "employment-1" },
    method: "GET",
    path: "/company/employment-start-corrections",
    query: { employment_id: "employment-1" },
    headers: organization,
  },
  {
    tool: "employment_start_corrections_create",
    args: {
      ...command,
      employmentId: "employment-1",
      correctsRevision: 1,
      startsOn: "2026-10-01",
      reason: "Correct the start date",
      evidenceReferences: evidence,
    },
    method: "POST",
    path: "/company/employment-start-corrections",
    headers: commandHeaders,
    body: {
      employmentId: "employment-1",
      correctsRevision: 1,
      startsOn: "2026-10-01",
      reason: "Correct the start date",
      evidenceReferences: evidence,
    },
  },
  {
    tool: "company_changes_list",
    args: { organization_id: ids.organization, limit: 10, resource_type: "employee" },
    method: "GET",
    path: "/company/changes",
    query: { limit: "10", resource_type: "employee" },
    headers: organization,
  },
  {
    tool: "company_resource_history",
    args: { organization_id: ids.organization, type: "employee", id: "employee-1", limit: 5 },
    method: "GET",
    path: "/company/resource-history/employee/employee-1",
    query: { limit: "5" },
    headers: organization,
  },
  {
    tool: "grade_assignment_history",
    args: {
      organization_id: ids.organization,
      employee_id: "employee-1",
      organization_revision: 7,
    },
    method: "GET",
    path: "/company/grade-assignment-history",
    query: { employee_id: "employee-1", organization_revision: "7" },
    headers: organization,
  },
  listCase("legacy_personnel_action_records_list", "/company/legacy-personnel-action-records"),
]
