import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { readOnly, registerApiTool, segment, write } from "@/lib/api-tool"
import {
  companyCorrection,
  companyListQuery,
  companyResource,
  companyResourceType,
  evidenceReferences,
  withIds,
} from "@/lib/company-inputs"
import {
  expectedRevision,
  idempotencyKey,
  intentNote,
  numericText,
  organizationId,
  pathId,
} from "@/lib/tool-inputs"

const organizationChangeTypes = [
  "legal-entity",
  "site",
  "workplace",
  "person",
  "employee",
  "employment",
  "organization-unit",
  "assignment",
  "reporting-relation",
  "grade",
  "grade-assignment",
  "office-assignment",
  "responsibility-assignment",
  "collective-body-membership",
  "organizational-authority",
] as const
const reason = z.string().trim().min(1).max(2_000)
const commandHeaders = {
  organization_id: organizationId,
  expected_revision: expectedRevision,
  idempotency_key: idempotencyKey,
}
const saveNote = `Each resource is a full revision with camelCase attributes; read the current version first and send the next revision. ${intentNote} Reuse idempotency_key when retrying; after a conflict read again.`

/** Company正本の一覧と、版を前提にした保存を一組で登録する。 */
function registerCompanyResource<const Types extends readonly [string, ...string[]]>(
  server: McpServer,
  props: {
    name: string
    path: string
    label: string
    types: Types
    query?: z.ZodRawShape
    attributes: string
    body?: z.ZodRawShape
  },
) {
  registerApiTool(server, {
    name: `${props.name}_list`,
    description: `List ${props.label} in one Company organization at a revision or date.`,
    annotations: readOnly,
    input: { organization_id: organizationId, ...companyListQuery, ...props.query },
    request: ({ organization_id, id, ...query }) => ({
      path: withIds(props.path, id as string | string[] | undefined),
      query: query as Record<string, string | number | boolean | undefined>,
      organizationId: organization_id,
    }),
  })
  registerApiTool(server, {
    name: `${props.name}_save`,
    description: `Create, revise or void ${props.label}. Resource types: ${props.types.join(", ")}. Attributes: ${props.attributes}. ${saveNote}`,
    annotations: write,
    input: {
      ...commandHeaders,
      reason,
      resources: z.array(companyResource(props.types)).min(1).max(100),
      ...props.body,
    },
    request: ({ organization_id, expected_revision, idempotency_key, ...body }) => ({
      path: props.path,
      method: "POST",
      json: body,
      organizationId: organization_id,
      ifMatch: String(expected_revision),
      idempotencyKey: idempotency_key,
    }),
  })
}

/** Companyの法人・人・従業員・雇用・定義など、版で管理する正本と変更履歴を扱う。 */
export function registerCompanyRecordTools(server: McpServer) {
  registerCompanyResource(server, {
    name: "company_employees",
    path: "/company/employees",
    label: "Company employees",
    types: ["employee"],
    attributes: "personId, employeeCode (nullable, optional)",
  })
  registerCompanyResource(server, {
    name: "company_people",
    path: "/company/people",
    label: "Company people",
    types: ["person"],
    attributes: "officialName, email (nullable, optional), phone (nullable, optional)",
  })
  registerCompanyResource(server, {
    name: "company_employments",
    path: "/company/employments",
    label: "Company employments",
    types: ["employment"],
    query: {
      employee_id: z
        .string()
        .regex(/^\S{1,255}$/)
        .optional(),
      include_ended: z.boolean().optional(),
    },
    attributes:
      "employeeId, status (ACTIVE|ON_LEAVE|TERMINATED), employmentType (FULL_TIME|PART_TIME), contractTerm ({kind:FIXED_TERM,startsOn,endsBefore}|{kind:INDEFINITE,startsOn}|null, optional), employerLegalEntityId (nullable, optional), officialName (optional)",
  })
  registerCompanyResource(server, {
    name: "company_profile",
    path: "/company/profile",
    label: "the legal entity and company profile",
    types: ["legal-entity", "company-profile"],
    attributes:
      "legal-entity: officialName, jurisdictionCountryCode, registrationNumber (nullable), defaultCurrencyCode; company-profile: displayName, representativeName (optional), locale, timeZone, fiscalYearStartMonth",
    body: {
      evidenceReferences: evidenceReferences.optional(),
      corrections: z
        .array(companyCorrection.extend({ type: z.enum(["legal-entity", "company-profile"]) }))
        .max(100)
        .optional(),
    },
  })
  registerCompanyResource(server, {
    name: "company_definitions",
    path: "/company/definitions",
    label:
      "Company definitions (sites, workplaces, jobs, positions, grades, offices, responsibilities, authority scopes, collective bodies)",
    types: [
      "site",
      "workplace",
      "job",
      "position",
      "grade",
      "organizational-office",
      "responsibility",
      "authority-scope",
      "collective-body",
    ],
    query: { type: z.enum(["grade", "position"]).optional() },
    attributes:
      "per type as returned by company_definitions_list; for example grade: code, officialName, rank (nullable, optional), description (nullable, optional)",
  })

  registerApiTool(server, {
    name: "organization_snapshots_list",
    description: "Read the Company organization snapshot at a revision or date.",
    annotations: readOnly,
    input: { organization_id: organizationId, ...companyListQuery },
    request: ({ organization_id, id, ...query }) => ({
      path: withIds("/company/organization-snapshots", id),
      query,
      organizationId: organization_id,
    }),
  })
  registerApiTool(server, {
    name: "organization_changes_create",
    description: `Record one atomic Company organization change across resource types (${organizationChangeTypes.join(", ")}), with optional evidence and revision corrections. ${saveNote}`,
    annotations: write,
    input: {
      ...commandHeaders,
      reason,
      evidenceReferences: evidenceReferences.optional(),
      corrections: z.array(companyCorrection).max(100).optional(),
      resources: z.array(companyResource(organizationChangeTypes)).min(1).max(100),
    },
    request: ({ organization_id, expected_revision, idempotency_key, ...body }) => ({
      path: "/company/organization-changes",
      method: "POST",
      json: body,
      organizationId: organization_id,
      ifMatch: String(expected_revision),
      idempotencyKey: idempotency_key,
    }),
  })
  registerApiTool(server, {
    name: "employment_start_corrections_list",
    description:
      "List corrections of an employment start date in the default Company organization.",
    annotations: readOnly,
    input: {
      organization_id: organizationId,
      employment_id: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/),
      organization_revision: numericText.optional(),
    },
    request: ({ organization_id, ...query }) => ({
      path: "/company/employment-start-corrections",
      query,
      organizationId: organization_id,
    }),
  })
  registerApiTool(server, {
    name: "employment_start_corrections_create",
    description: `Correct the start date of an employment revision with evidence. ${intentNote} Reuse idempotency_key when retrying; after a conflict read again.`,
    annotations: write,
    input: {
      ...commandHeaders,
      employmentId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/),
      correctsRevision: z.number().int().positive(),
      startsOn: z.iso.date(),
      reason,
      evidenceReferences: evidenceReferences.min(1),
    },
    request: ({ organization_id, expected_revision, idempotency_key, ...body }) => ({
      path: "/company/employment-start-corrections",
      method: "POST",
      json: body,
      organizationId: organization_id,
      ifMatch: String(expected_revision),
      idempotencyKey: idempotency_key,
    }),
  })
  registerApiTool(server, {
    name: "company_changes_list",
    description:
      "List Company changes with reasons and evidence, filtered by what you may read. Continue with the returned cursor.",
    annotations: readOnly,
    input: {
      organization_id: organizationId,
      cursor: z.string().max(4096).optional(),
      through_revision: z.number().int().nonnegative().optional(),
      limit: z.number().int().min(1).max(100).optional(),
      resource_type: companyResourceType.optional(),
    },
    request: ({ organization_id, ...query }) => ({
      path: "/company/changes",
      query,
      organizationId: organization_id,
    }),
  })
  registerApiTool(server, {
    name: "company_resource_history",
    description: "Read every revision of one Company resource.",
    annotations: readOnly,
    input: {
      organization_id: organizationId,
      type: companyResourceType,
      id: pathId,
      after_revision: numericText.optional(),
      through_revision: numericText.optional(),
      limit: z.number().int().min(1).max(100).optional(),
    },
    request: ({ organization_id, type, id, ...query }) => ({
      path: `/company/resource-history/${segment(type)}/${segment(id)}`,
      query,
      organizationId: organization_id,
    }),
  })
  registerApiTool(server, {
    name: "grade_assignment_history",
    description: "Read every grade assignment revision of an employee at an organization revision.",
    annotations: readOnly,
    input: {
      organization_id: organizationId,
      employee_id: z.string().regex(/^\S{1,128}$/),
      organization_revision: numericText,
      offset: numericText.optional(),
      limit: numericText.optional(),
    },
    request: ({ organization_id, ...query }) => ({
      path: "/company/grade-assignment-history",
      query,
      organizationId: organization_id,
    }),
  })
  registerApiTool(server, {
    name: "legacy_personnel_action_records_list",
    description: "List personnel action records migrated from the legacy ledger.",
    annotations: readOnly,
    input: { organization_id: organizationId, ...companyListQuery },
    request: ({ organization_id, id, ...query }) => ({
      path: withIds("/company/legacy-personnel-action-records", id),
      query,
      organizationId: organization_id,
    }),
  })
}
