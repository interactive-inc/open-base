import { help } from "@/app/company/route"
import type { ApiCommandCase } from "@/tests/support/describe-api-commands"
import { createCliFixtures } from "@/tests/support/create-cli-fixtures"
import { describeApiCommands } from "@/tests/support/describe-api-commands"

const fixtures = createCliFixtures("company")
const change = { reason: "確認した", resources: [{ type: "example" }] }
const confirmed = fixtures.writeJson("confirmed.json", {
  organizationId: "org-1",
  expectedRevision: 7,
  ...change,
})
const companyHeaders = {
  "x-company-organization-id": "org-1",
  "if-match": "7",
  "idempotency-key": "key-1",
}
const profile = { phone: null, reason: "連絡先を消す" }
const profileFile = fixtures.writeJson("my-profile.json", profile)
const completion = { reason: "接続を確認した" }
const completionFile = fixtures.writeJson("completion.json", completion)
const resolution = { as_of: "2026-04-01", subject_employee_id: null, criteria: [] }
const resolutionFile = fixtures.writeJson("resolution.json", resolution)

const savedResources = [
  "employees",
  "people",
  "employments",
  "employment-start-corrections",
  "profile",
  "definitions",
]

const recordCases: Array<ApiCommandCase> = savedResources.map((resource) => ({
  name: `${resource} save`,
  argv: ["company", resource, "save", "--data", confirmed, "--idempotency-key", "key-1"],
  expected: { method: "POST", path: `/company/${resource}`, headers: companyHeaders, body: change },
}))

const listCases: Array<ApiCommandCase> = [
  {
    name: "employees list",
    argv: [
      "company",
      "employees",
      "list",
      "--organization-id",
      "org-1",
      "--organization-revision",
      "3",
    ],
    expected: {
      method: "GET",
      path: "/company/employees",
      query: { organization_revision: "3" },
      headers: { "x-company-organization-id": "org-1" },
    },
  },
  {
    name: "people list",
    argv: ["company", "people", "list", "--organization-id", "org-1", "--id", "person-1"],
    expected: {
      method: "GET",
      path: "/company/people",
      query: { id: "person-1" },
      headers: { "x-company-organization-id": "org-1" },
    },
  },
  {
    name: "employments list",
    argv: [
      "company",
      "employments",
      "list",
      "--organization-id",
      "org-1",
      "--employee-id",
      "e-1",
      "--include-ended",
      "true",
    ],
    expected: {
      method: "GET",
      path: "/company/employments",
      query: { employee_id: "e-1", include_ended: "true" },
      headers: { "x-company-organization-id": "org-1" },
    },
  },
  {
    name: "employment-start-corrections list",
    argv: [
      "company",
      "employment-start-corrections",
      "list",
      "--organization-id",
      "org-1",
      "--employment-id",
      "m-1",
    ],
    expected: {
      method: "GET",
      path: "/company/employment-start-corrections",
      query: { employment_id: "m-1" },
      headers: { "x-company-organization-id": "org-1" },
    },
  },
  {
    name: "profile list",
    argv: [
      "company",
      "profile",
      "list",
      "--organization-id",
      "org-1",
      "--effective-on",
      "2026-04-01",
    ],
    expected: {
      method: "GET",
      path: "/company/profile",
      query: { effective_on: "2026-04-01" },
      headers: { "x-company-organization-id": "org-1" },
    },
  },
  {
    name: "definitions list",
    argv: ["company", "definitions", "list", "--organization-id", "org-1", "--type", "grade"],
    expected: {
      method: "GET",
      path: "/company/definitions",
      query: { type: "grade" },
      headers: { "x-company-organization-id": "org-1" },
    },
  },
  {
    name: "organization-snapshots list",
    argv: ["company", "organization-snapshots", "list", "--organization-id", "org-1"],
    expected: {
      method: "GET",
      path: "/company/organization-snapshots",
      headers: { "x-company-organization-id": "org-1" },
    },
  },
  {
    name: "organization-changes save",
    argv: [
      "company",
      "organization-changes",
      "save",
      "--data",
      confirmed,
      "--idempotency-key",
      "key-1",
    ],
    expected: {
      method: "POST",
      path: "/company/organization-changes",
      headers: companyHeaders,
      body: change,
    },
  },
]

const historyCases: Array<ApiCommandCase> = [
  {
    name: "changes",
    argv: [
      "company",
      "changes",
      "--organization-id",
      "org-1",
      "--resource-type",
      "employee",
      "--limit",
      "5",
    ],
    expected: {
      method: "GET",
      path: "/company/changes",
      query: { resource_type: "employee", limit: "5" },
      headers: { "x-company-organization-id": "org-1" },
    },
  },
  {
    name: "resource-history",
    argv: [
      "company",
      "resource-history",
      "employee",
      "e-1",
      "--organization-id",
      "org-1",
      "--after-revision",
      "2",
    ],
    expected: {
      method: "GET",
      path: "/company/resource-history/employee/e-1",
      query: { after_revision: "2" },
      headers: { "x-company-organization-id": "org-1" },
    },
  },
  {
    name: "grade-assignment-history",
    argv: [
      "company",
      "grade-assignment-history",
      "--organization-id",
      "org-1",
      "--employee-id",
      "e-1",
    ],
    expected: {
      method: "GET",
      path: "/company/grade-assignment-history",
      query: { employee_id: "e-1" },
      headers: { "x-company-organization-id": "org-1" },
    },
  },
  {
    name: "legacy-personnel-action-records",
    argv: [
      "company",
      "legacy-personnel-action-records",
      "--organization-id",
      "org-1",
      "--as-of",
      "2026-04-01",
    ],
    expected: {
      method: "GET",
      path: "/company/legacy-personnel-action-records",
      query: { as_of: "2026-04-01" },
      headers: { "x-company-organization-id": "org-1" },
    },
  },
  {
    name: "definition-resource-adoptions",
    argv: ["company", "definition-resource-adoptions", "command-1"],
    expected: { method: "GET", path: "/company/definition-resource-adoptions/command-1" },
  },
  {
    name: "grade-award-archives",
    argv: ["company", "grade-award-archives", "command-1"],
    expected: { method: "GET", path: "/company/grade-award-archives/command-1" },
  },
  {
    name: "grade-award-archives by-employee",
    argv: ["company", "grade-award-archives", "by-employee", "e-1"],
    expected: { method: "GET", path: "/company/grade-award-archives/by-employee/e-1" },
  },
]

const settingCases: Array<ApiCommandCase> = [
  {
    name: "my-profile show",
    argv: ["company", "my-profile", "show"],
    expected: { method: "GET", path: "/company/my-profile" },
  },
  {
    name: "my-profile update",
    argv: ["company", "my-profile", "update", "--data", profileFile, "--idempotency-key", "key-2"],
    expected: {
      method: "PUT",
      path: "/company/my-profile",
      headers: { "idempotency-key": "key-2" },
      body: profile,
    },
  },
  {
    name: "my-direct-reports",
    argv: ["company", "my-direct-reports"],
    expected: { method: "GET", path: "/company/my-direct-reports" },
  },
  {
    name: "my-organization-units",
    argv: ["company", "my-organization-units"],
    expected: { method: "GET", path: "/company/my-organization-units" },
  },
  {
    name: "organization-profile show",
    argv: ["company", "organization-profile", "show"],
    expected: { method: "GET", path: "/company/organization-profile" },
  },
  {
    name: "organization-profile update",
    argv: [
      "company",
      "organization-profile",
      "update",
      "--data",
      profileFile,
      "--idempotency-key",
      "key-3",
    ],
    expected: {
      method: "PUT",
      path: "/company/organization-profile",
      headers: { "idempotency-key": "key-3" },
      body: profile,
    },
  },
  {
    name: "workforce-connection-completions list",
    argv: ["company", "workforce-connection-completions", "list"],
    expected: { method: "GET", path: "/company/workforce-connection-completions" },
  },
  {
    name: "workforce-connection-completions create",
    argv: [
      "company",
      "workforce-connection-completions",
      "create",
      "--data",
      completionFile,
      "--idempotency-key",
      "key-4",
    ],
    expected: {
      method: "POST",
      path: "/company/workforce-connection-completions",
      headers: { "idempotency-key": "key-4" },
      body: completion,
    },
  },
  {
    name: "authority-resolutions resolve",
    argv: [
      "company",
      "authority-resolutions",
      "resolve",
      "--organization-id",
      "org-1",
      "--data",
      resolutionFile,
    ],
    expected: {
      method: "POST",
      path: "/company/authority-resolutions",
      headers: { "x-company-organization-id": "org-1" },
      body: resolution,
    },
  },
  {
    name: "capabilities",
    argv: ["company", "capabilities"],
    expected: { method: "GET", path: "/company/capabilities" },
  },
  {
    name: "features",
    argv: ["company", "features"],
    expected: { method: "GET", path: "/company/features" },
  },
  {
    name: "inbox-counts",
    argv: ["company", "inbox-counts"],
    expected: { method: "GET", path: "/company/inbox/counts" },
  },
]

describeApiCommands({
  group: "company",
  help,
  cases: [...recordCases, ...listCases, ...historyCases, ...settingCases],
})
