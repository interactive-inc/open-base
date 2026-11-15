import { ids } from "@/tests/cases/ids"
import { stepUp, type ToolCase } from "@/tests/support/tool-cases"

const preservation = {
  id: ids.a,
  sha256: ids.digest,
  kind: "hold",
  retainUntil: null,
  reason: "Litigation hold",
}
const release = { operationId: ids.c, expectedRevision: 1, reason: "Hold ended" }
const erasure = {
  request_id: ids.a,
  template_code: "erasure",
  reason: "Requested by the person",
  target: { kind: "employee", employee_code: "E001" },
}

export const attachmentCases: ReadonlyArray<ToolCase> = [
  {
    tool: "attachments_download",
    args: { attachment_id: "attachment-1" },
    method: "GET",
    path: "/system/attachments/attachment-1",
    download: true,
  },
  {
    tool: "attachments_purge_unlinked",
    args: {},
    method: "POST",
    path: "/system/attachments/purge-unlinked",
  },
  {
    tool: "attachment_preservations_list",
    args: { attachment_id: "attachment-1", limit: 10 },
    method: "GET",
    path: "/system/attachments/attachment-1/preservations",
    query: { limit: "10" },
  },
  {
    tool: "attachment_preservations_create",
    args: { attachment_id: "attachment-1", preservation, step_up_token: stepUp },
    method: "POST",
    path: "/system/attachments/attachment-1/preservations",
    headers: { "x-system-step-up": stepUp },
    body: preservation,
  },
  {
    tool: "attachment_preservations_release",
    args: {
      attachment_id: "attachment-1",
      preservation_id: ids.b,
      ...release,
      step_up_token: stepUp,
    },
    method: "POST",
    path: `/system/attachments/attachment-1/preservations/${ids.b}/release`,
    headers: { "x-system-step-up": stepUp },
    body: release,
  },
]

export const recordCases: ReadonlyArray<ToolCase> = [
  {
    tool: "personal_data_erasure_requests_create",
    args: erasure,
    method: "POST",
    path: "/company/personal-data-erasure-requests",
    body: erasure,
  },
  {
    tool: "personal_data_erasure_execute",
    args: { application_id: "12" },
    method: "POST",
    path: "/company/personal-data-erasure-requests/12/execute",
  },
  {
    tool: "preserved_records_list",
    args: { action: "read", purpose: "investigation", owner_context: "company" },
    method: "GET",
    path: "/system/preserved-records",
    query: { action: "read", purpose: "investigation", owner_context: "company" },
  },
  {
    tool: "preserved_records_content",
    args: { record_id: ids.a, action: "export", purpose: "investigation", format: "package" },
    method: "GET",
    path: `/system/preserved-records/${ids.a}/content`,
    query: { action: "export", purpose: "investigation", format: "package" },
    download: true,
  },
  {
    tool: "preserved_records_dossier",
    args: { record_id: ids.a, purpose: "investigation" },
    method: "GET",
    path: `/system/preserved-records/${ids.a}/dossier`,
    query: { purpose: "investigation" },
  },
  {
    tool: "proposal_versions_show",
    args: { number: 3, version: 2 },
    method: "GET",
    path: "/system/proposals/3/versions/2",
  },
]
