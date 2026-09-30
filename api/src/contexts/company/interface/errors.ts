import { HTTPException } from "hono/http-exception"

export type CompanyHTTPExceptionStatus =
  | 400
  | 401
  | 403
  | 404
  | 409
  | 413
  | 415
  | 422
  | 423
  | 429
  | 500
  | 502
  | 503

export type CompanyHTTPExceptionProps = Readonly<{
  status: CompanyHTTPExceptionStatus
  code: string
  detail: string
  etag?: string
  issues?: readonly unknown[]
  metadata?: Readonly<Record<string, unknown>>
  cause?: unknown
}>

/**
 * Company の HTTP 境界で検出した失敗。JSON への変換は API の onError だけが行う。
 */
export class CompanyHTTPException extends HTTPException {
  override readonly status: CompanyHTTPExceptionStatus

  constructor(private readonly props: CompanyHTTPExceptionProps) {
    super(props.status, {
      message: props.detail,
      ...(props.cause === undefined ? {} : { cause: props.cause }),
    })
    this.name = new.target.name
    this.status = props.status
  }

  get code(): string {
    return this.props.code
  }

  get detail(): string {
    return this.props.detail
  }

  get etag(): string | null {
    return this.props.etag ?? null
  }

  get issues(): readonly unknown[] | null {
    return this.props.issues ?? null
  }

  get metadata(): Readonly<Record<string, unknown>> {
    return this.props.metadata ?? {}
  }
}

export class CompanyAccessDeniedError extends CompanyHTTPException {
  constructor() {
    super({
      status: 403,
      code: "company_access_denied",
      detail: "Company scope or capability is missing",
    })
  }
}

export class CompanyAuthenticationRequiredError extends CompanyHTTPException {
  constructor() {
    super({
      status: 401,
      code: "authentication_required",
      detail: "Authentication is required",
    })
  }
}

export class CompanyBodyInvalidError extends CompanyHTTPException {
  constructor(cause: unknown) {
    super({
      status: 400,
      code: "invalid_company_body",
      detail: "Company request body is invalid",
      cause,
    })
  }
}

export class CompanyApplicationConflictError extends CompanyHTTPException {
  constructor(code: string, detail: string) {
    super({ status: 409, code, detail })
  }
}

export class CompanyApplicationForbiddenError extends CompanyHTTPException {
  constructor(code: string, detail: string) {
    super({ status: 403, code, detail })
  }
}

export class CompanyApplicationNotFoundError extends CompanyHTTPException {
  constructor(code: string, detail: string) {
    super({ status: 404, code, detail })
  }
}

export class CompanyApplicationUnavailableError extends CompanyHTTPException {
  constructor(code: string, detail: string, cause: unknown) {
    super({ status: 503, code, detail, cause })
  }
}

export class CompanyApplicationValidationError extends CompanyHTTPException {
  constructor(code: string, detail: string) {
    super({ status: 422, code, detail })
  }
}

export class CompanyBootstrapInputInvalidError extends CompanyHTTPException {
  constructor(cause?: unknown) {
    super({
      status: 400,
      code: "invalid_company_bootstrap_input",
      detail: "Company bootstrap request body is invalid",
      cause,
    })
  }
}

export class CompanyBootstrapUnavailableError extends CompanyHTTPException {
  constructor(cause?: unknown) {
    super({
      status: 503,
      code: "company_bootstrap_unavailable",
      detail: "Company bootstrap service is unavailable",
      cause,
    })
  }
}

export class CompanyCommandConflictError extends CompanyHTTPException {
  constructor() {
    super({
      status: 409,
      code: "company_command_conflict",
      detail: "Idempotency key was reused",
    })
  }
}

export class CompanyDatabaseUnavailableError extends CompanyHTTPException {
  constructor() {
    super({
      status: 503,
      code: "company_database_unavailable",
      detail: "Company storage is unavailable",
    })
  }
}

export class CompanyEffectiveDateQueryConflictError extends CompanyHTTPException {
  constructor() {
    super({
      status: 400,
      code: "invalid_company_query",
      detail: "effective_on and as_of must name the same date",
    })
  }
}

export class CompanyEmployeeIdentityRequiredError extends CompanyHTTPException {
  constructor() {
    super({
      status: 403,
      code: "forbidden",
      detail: "An employee identity is required",
    })
  }
}

export class CompanyEmployeeNotFoundError extends CompanyHTTPException {
  constructor() {
    super({
      status: 404,
      code: "employee_not_found",
      detail: "Employee was not found",
    })
  }
}

export class CompanyHeadersInvalidError extends CompanyHTTPException {
  constructor(cause: unknown) {
    super({
      status: 400,
      code: "invalid_company_headers",
      detail: "Company request headers are invalid",
      cause,
    })
  }
}

export class CompanyInvariantValidationError extends CompanyHTTPException {
  constructor(code: string, cause?: unknown) {
    super({ status: 422, code, detail: "Company invariant validation failed", cause })
  }
}

export class CompanyIdempotencyKeyRequiredError extends CompanyHTTPException {
  constructor() {
    super({
      status: 400,
      code: "idempotency_key_required",
      detail: "Idempotency-Key is required",
    })
  }
}

export class CompanyOrganizationAmbiguousError extends CompanyHTTPException {
  constructor() {
    super({
      status: 403,
      code: "company_organization_ambiguous",
      detail: "Exactly one Company organization must be selected",
    })
  }
}

export class CompanyOrganizationProfileInvalidError extends CompanyHTTPException {
  constructor(cause: unknown) {
    super({
      status: 400,
      code: "invalid_organization_profile",
      detail: "Organization profile is invalid",
      cause,
    })
  }
}

export class CompanyOrganizationProfileNotConfiguredError extends CompanyHTTPException {
  constructor() {
    super({
      status: 404,
      code: "organization_profile_not_configured",
      detail: "Organization profile is not configured",
    })
  }
}

export class CompanyOrganizationProfileReadFailedError extends CompanyHTTPException {
  constructor(cause: unknown) {
    super({
      status: 500,
      code: "organization_profile_read_failed",
      detail: "Organization profile could not be read",
      cause,
    })
  }
}

export class CompanyOrganizationProfileWriteFailedError extends CompanyHTTPException {
  constructor(cause: unknown) {
    super({
      status: 500,
      code: "organization_profile_write_failed",
      detail: "Organization profile could not be written",
      cause,
    })
  }
}

export class CompanyOrganizationUnitNotFoundError extends CompanyHTTPException {
  constructor() {
    super({
      status: 404,
      code: "organization_unit_not_found",
      detail: "Organization unit was not found",
    })
  }
}

export class CompanyQueryInvalidError extends CompanyHTTPException {
  constructor(cause: unknown) {
    super({
      status: 400,
      code: "invalid_company_query",
      detail: "Company query is invalid",
      cause,
    })
  }
}

export class CompanyReadForbiddenError extends CompanyHTTPException {
  constructor() {
    super({
      status: 403,
      code: "company_read_forbidden",
      detail: "Company read capability is required",
    })
  }
}

export class CompanyReadUnavailableError extends CompanyHTTPException {
  constructor(cause: unknown) {
    super({
      status: 503,
      code: "company_read_unavailable",
      detail: "Company data could not be read",
      cause,
    })
  }
}

export class CompanyReportingLineNotFoundError extends CompanyHTTPException {
  constructor() {
    super({
      status: 404,
      code: "reporting_line_not_found",
      detail: "Reporting line was not found",
    })
  }
}

export class CompanyResourceConflictError extends CompanyHTTPException {
  constructor() {
    super({
      status: 409,
      code: "company_resource_conflict",
      detail: "Resource revision has changed",
    })
  }
}

export class CompanyResourceOrganizationMismatchError extends CompanyHTTPException {
  constructor() {
    super({
      status: 422,
      code: "invalid_company_resource",
      detail: "A Company resource is outside the requested organization",
    })
  }
}

export class CompanyRevisionConflictError extends CompanyHTTPException {
  constructor(etag: string) {
    super({
      status: 409,
      code: "company_revision_conflict",
      detail: "Company revision has changed",
      etag,
    })
  }
}

export class CompanyWriteForbiddenError extends CompanyHTTPException {
  constructor(cause: unknown) {
    super({
      status: 403,
      code: "company_write_forbidden",
      detail: "Company write capability is required",
      cause,
    })
  }
}

export class CompanyWriteUnavailableError extends CompanyHTTPException {
  constructor(cause: unknown) {
    super({
      status: 503,
      code: "company_write_unavailable",
      detail: "Company change was not applied",
      cause,
    })
  }
}

export class CompanyExternalIdentityImportError extends CompanyHTTPException {
  constructor(kind: "invalid" | "conflict" | "forbidden" | "unavailable", reason: string = kind) {
    super({
      status:
        kind === "invalid" ? 400 : kind === "conflict" ? 409 : kind === "forbidden" ? 403 : 503,
      code: `company_external_identity_import_${kind}`,
      detail: reason,
    })
  }
}
