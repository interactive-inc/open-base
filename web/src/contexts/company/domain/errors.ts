import { type WorkforceIdKind } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { DomainError } from "@/contexts/system/domain/errors"

export class CompanyAccountNameManagedByEmployeeError extends DomainError {
  readonly code = "account_name_managed_by_employee"

  constructor(options?: ErrorOptions) {
    super("account name is managed by the employee record", options)
    this.name = "CompanyAccountNameManagedByEmployeeError"
  }
}

export type CompanyResourceValidationCode =
  | "invalid_identifier"
  | "invalid_revision"
  | "invalid_period"
  | "invalid_attributes"
  | "invalid_resource"
  | "unlinked_start_correction"
  | "invalid_organization"
  | "invalid_change"
  | "invalid_query"

export type OrganizationalAuthorityErrorCode =
  | "organizational_authority_snapshot_invalid"
  | "organizational_authority_employee_duplicate"
  | "organizational_authority_state_as_of_mismatch"
  | "organizational_authority_state_invalid"
  | "organizational_authority_period_invalid"
  | "organizational_authority_period_duplicate"
  | "organizational_authority_employee_reference_missing"
  | "organizational_authority_subject_missing"
  | "organizational_authority_account_employee_duplicate"
  | "organizational_authority_account_duplicate"
  | "organizational_authority_account_employee_missing"
  | "organizational_authority_manager_cycle"
  | "organizational_authority_reporting_source_conflict"

export type CompanyGovernanceAuthorityErrorCode =
  | "governance_authority_snapshot_invalid"
  | "governance_authority_resource_ambiguous"
  | "governance_authority_reference_missing"
  | "governance_authority_account_link_ambiguous"
  | "governance_authority_collective_body_invalid"
  | "governance_authority_task_invalid"

export type WorkforceStateResolutionCode =
  | "employment_state_ambiguous"
  | "status_state_missing"
  | "status_state_ambiguous"
  | "primary_assignment_state_ambiguous"

export type OrganizationChangeValidationCode =
  | "empty_change"
  | "invalid_revision"
  | "invalid_operation"
  | "invalid_audit"
  | "invalid_identity"
  | "unknown_employee"
  | "invalid_organization"
  | "invalid_workforce"

export type AccountEmployeeLinkResolutionCode =
  | "account_link_ambiguous"
  | "account_link_account_mismatch"
  | "account_link_employee_mismatch"

export class AccountEmployeeLinkResolutionError extends DomainError {
  constructor(readonly code: AccountEmployeeLinkResolutionCode) {
    super(code)
    this.name = "AccountEmployeeLinkResolutionError"
  }
}

export class CompanyOperationError extends DomainError {
  constructor(
    message: string,
    readonly code: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = new.target.name
  }
}

export class CompanyConflictError extends CompanyOperationError {
  constructor(message: string, code: string, options?: ErrorOptions) {
    super(message, code, options)
  }
}

export class CompanyGovernanceAuthorityError extends DomainError {
  constructor(readonly code: CompanyGovernanceAuthorityErrorCode) {
    super(code)
    this.name = "CompanyGovernanceAuthorityError"
  }
}

export class CompanyForbiddenError extends CompanyOperationError {
  constructor(
    message = "この操作を行う権限がありません。",
    code = "forbidden",
    options?: ErrorOptions,
  ) {
    super(message, code, options)
  }
}

export class CompanyNotFoundError extends CompanyOperationError {
  constructor(message: string, code: string, options?: ErrorOptions) {
    super(message, code, options)
  }
}

export class CompanySnapshotRevisionError extends DomainError {
  constructor() {
    super("Company snapshot revision is unavailable")
    this.name = "CompanySnapshotRevisionError"
  }
}

export class CompanyResourceValidationError extends DomainError {
  constructor(readonly code: CompanyResourceValidationCode) {
    super(code)
    this.name = "CompanyResourceValidationError"
  }
}

export class CompanyTimeZoneError extends DomainError {
  constructor(options?: ErrorOptions) {
    super("company time zone is unavailable", options)
    this.name = "CompanyTimeZoneError"
  }
}

/** 監査のJSONやCSV exportが容量上限を超え、処理を継続できない。 */
export class CompanyPayloadTooLargeError extends CompanyOperationError {
  constructor(message: string, code: string, options?: ErrorOptions) {
    super(message, code, options)
  }
}

export class CompanyUnavailableError extends CompanyOperationError {
  constructor(message: string, code: string, options?: ErrorOptions) {
    super(message, code, options)
  }
}

export class CompanyUnexpectedError extends CompanyOperationError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, "unexpected", options)
  }
}

export class CompanyUniqueConstraintError extends DomainError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = "CompanyUniqueConstraintError"
  }
}

export class CompanyValidationError extends CompanyOperationError {
  constructor(message: string, code: string, options?: ErrorOptions) {
    super(message, code, options)
  }
}

export class InvalidBusinessDateError extends DomainError {
  constructor(options?: ErrorOptions) {
    super("business date is invalid", options)
    this.name = "InvalidBusinessDateError"
  }
}

export class InvalidCalendarDateError extends DomainError {
  readonly code = "invalid_calendar_date"

  constructor() {
    super("invalid calendar date")
    this.name = "InvalidCalendarDateError"
  }
}

export class InvalidCompanyActorError extends DomainError {
  readonly code = "invalid_company_actor"

  constructor() {
    super("company actor is not canonical")
    this.name = "InvalidCompanyActorError"
  }
}

export class InvalidEmployeeError extends DomainError {
  readonly code = "invalid_employee"

  constructor() {
    super("employee profile is not canonical")
    this.name = "InvalidEmployeeError"
  }
}

export class InvalidOrganizationLifecycleStateError extends DomainError {
  readonly code = "invalid_organization_lifecycle_state"

  constructor() {
    super("organization lifecycle state is missing or invalid")
    this.name = "InvalidOrganizationLifecycleStateError"
  }
}

export class InvalidOrganizationPeriodProjectionError extends DomainError {
  readonly code = "invalid_organization_period_projection"

  constructor() {
    super("organization period rows cannot be projected to the canonical workforce model")
    this.name = "InvalidOrganizationPeriodProjectionError"
  }
}

export class InvalidOrganizationResponsibilityTypeError extends DomainError {
  readonly code = "invalid_organization_responsibility_type"

  constructor() {
    super("organization responsibility type is not canonical")
    this.name = "InvalidOrganizationResponsibilityTypeError"
  }
}

export class InvalidOrganizationUnitProjectionError extends DomainError {
  readonly code = "invalid_organization_unit_projection"

  constructor() {
    super("organization unit rows cannot be projected to the canonical model")
    this.name = "InvalidOrganizationUnitProjectionError"
  }
}

export class InvalidWorkforceIdError extends DomainError {
  readonly code = "invalid_workforce_id"

  constructor(readonly kind: WorkforceIdKind) {
    super(`invalid ${kind} id`)
    this.name = "InvalidWorkforceIdError"
  }
}

export class InvalidWorkforceStateError extends DomainError {
  readonly code = "invalid_workforce_state"

  constructor() {
    super("workforce state is not canonical")
    this.name = "InvalidWorkforceStateError"
  }
}

export class OrganizationChangeValidationError extends DomainError {
  constructor(readonly code: OrganizationChangeValidationCode) {
    super(code)
    this.name = "OrganizationChangeValidationError"
  }
}

export class OrganizationalAuthorityError extends DomainError {
  constructor(readonly code: OrganizationalAuthorityErrorCode) {
    super(code)
    this.name = "OrganizationalAuthorityError"
  }
}

export class UnresolvableWorkflowStepError extends DomainError {
  constructor(readonly stepKey: string) {
    super(`workflow step has insufficient active approvers: ${stepKey}`)
    this.name = "UnresolvableWorkflowStepError"
    Object.freeze(this)
  }
}

export class WorkforceSnapshotChangedError extends DomainError {
  readonly code = "workforce_snapshot_changed"

  constructor() {
    super("company organization changed while workforce state was read")
    this.name = "WorkforceSnapshotChangedError"
  }
}

export class WorkforceStateResolutionError extends DomainError {
  constructor(readonly code: WorkforceStateResolutionCode) {
    super(code)
    this.name = "WorkforceStateResolutionError"
  }
}
