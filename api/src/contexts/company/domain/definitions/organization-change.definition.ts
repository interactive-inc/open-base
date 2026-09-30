import type { CalendarDate } from "@/contexts/company/domain/definitions/calendar-date.definition"
import type {
  OrganizationUnitPeriod,
  OrganizationUnitSnapshot,
} from "@/contexts/company/domain/definitions/organization-unit.definition"
import type {
  OrgAssignmentPeriod,
  OrgResponsibilityPeriod,
  WorkforceSchedule,
} from "@/contexts/company/domain/definitions/workforce-schedule.definition"
import type {
  OrganizationUnitId,
  PersonnelActionId,
} from "@/contexts/company/domain/definitions/workforce-id.definition"
import type { OrganizationChangeValidationError } from "@/contexts/company/domain/errors"

export type OrganizationUnitIdentity = Readonly<{
  id: OrganizationUnitId
  createdAt: number
}>

export type OrganizationChangeEvidenceReference = Readonly<{
  context: string
  kind: string
  id: string
  version: string
}>

export type OrganizationChangeSet = Readonly<{
  operationId: PersonnelActionId
  expectedRevision: number
  asOf: CalendarDate
  recordedAt: number
  actorAccountId: string
  reason: string
  evidenceReferences: ReadonlyArray<OrganizationChangeEvidenceReference>
  organizationUnits: ReadonlyArray<OrganizationUnitIdentity>
  unitPeriods: ReadonlyArray<OrganizationUnitPeriod>
  assignments: ReadonlyArray<OrgAssignmentPeriod>
  responsibilities: ReadonlyArray<OrgResponsibilityPeriod>
}>

export type WorkforceSnapshotReadResult =
  | Readonly<{ ok: true; schedules: ReadonlyArray<WorkforceSchedule> }>
  | Readonly<{ ok: false; cause: unknown }>

export type WorkforceSnapshotReadPort = {
  readAllSnapshot(asOf?: CalendarDate): Promise<WorkforceSnapshotReadResult>
}

export type OrganizationUnitSnapshotReadResult =
  | Readonly<{ ok: true; snapshot: OrganizationUnitSnapshot }>
  | Readonly<{ ok: false; cause: unknown }>

export type OrganizationRevisionReadResult =
  | Readonly<{ ok: true; revision: number }>
  | Readonly<{ ok: false; cause: unknown }>

export type OrganizationUnitReadPort = {
  readSnapshot(asOf: CalendarDate): Promise<OrganizationUnitSnapshotReadResult>
  readRevision(): Promise<OrganizationRevisionReadResult>
}

export type OrganizationChangeWriteResult =
  | Readonly<{ ok: true; revision: number; replayed: boolean }>
  | Readonly<{ ok: false; kind: "conflict"; actualRevision: number }>
  | Readonly<{ ok: false; kind: "operation_conflict" }>
  | Readonly<{ ok: false; kind: "unavailable"; cause: unknown }>

export type OrganizationChangeReplayReadResult =
  | Readonly<{ ok: true; kind: "not_found" }>
  | Readonly<{ ok: true; kind: "replayed"; revision: number }>
  | Readonly<{ ok: false; kind: "operation_conflict" }>
  | Readonly<{ ok: false; kind: "unavailable"; cause: unknown }>

export type OrganizationChangeWritePort = {
  findReplay(change: OrganizationChangeSet): Promise<OrganizationChangeReplayReadResult>
  append(change: OrganizationChangeSet): Promise<OrganizationChangeWriteResult>
}

export type OrganizationChangeServiceResult =
  | Readonly<{ kind: "applied"; revision: number; replayed: boolean }>
  | Readonly<{ kind: "conflict"; actualRevision: number }>
  | Readonly<{ kind: "operation_conflict" }>
  | Readonly<{ kind: "invalid"; error: OrganizationChangeValidationError }>
  | Readonly<{ kind: "unavailable"; cause: unknown }>

export type ValidateOrganizationChangeResult =
  | Readonly<{ kind: "valid"; resultingRevision: number }>
  | Exclude<OrganizationChangeServiceResult, Readonly<{ kind: "applied" }>>

export type OrganizationChangeReadPorts = Readonly<{
  organization: OrganizationUnitReadPort
  workforce: WorkforceSnapshotReadPort
}>
