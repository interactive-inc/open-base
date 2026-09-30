import { HTTPException } from "hono/http-exception"
import type { SystemWorkItemError } from "@system/domain/errors"

export type HTTPErrorBodyInput = Readonly<
  { error: string; message?: string } & Record<string, unknown>
>

export type HTTPErrorBody = Readonly<{ error: string; message: string } & Record<string, unknown>>

export type SystemHTTPExceptionStatus =
  | 400
  | 401
  | 403
  | 404
  | 405
  | 409
  | 413
  | 415
  | 422
  | 423
  | 429
  | 500
  | 502
  | 503

export type SystemHTTPExceptionProps = Readonly<{
  status: SystemHTTPExceptionStatus
  code: string
  detail: string
  metadata?: Readonly<Record<string, unknown>>
  cause?: unknown
}>

export type SystemApplicationFailure = Readonly<{
  status: SystemHTTPExceptionStatus
  body: Readonly<{ error: string; message: string } & Record<string, unknown>>
}>

export type OIDCHTTPExceptionCode =
  | "invalid_grant"
  | "invalid_request"
  | "invalid_scope"
  | "invalid_token"
  | "method_not_allowed"
  | "not_found"
  | "temporarily_unavailable"

/** SystemのHTTP境界で検出した失敗。JSONへの変換はAPIのonErrorだけが行う。 */
export class SystemHTTPException extends HTTPException {
  readonly code: string
  readonly detail: string
  readonly metadata: Readonly<Record<string, unknown>>

  constructor(props: SystemHTTPExceptionProps) {
    super(props.status, {
      message: props.detail,
      ...(props.cause === undefined ? {} : { cause: props.cause }),
    })
    this.name = new.target.name
    this.code = props.code
    this.detail = props.detail
    this.metadata = props.metadata ?? {}
  }
}

export class SystemAttachmentPreservationHttpError extends SystemHTTPException {
  constructor(props: SystemHTTPExceptionProps) {
    super(props)
  }
}

export class SystemAuditDisclosureHttpError extends SystemHTTPException {
  constructor(props: SystemHTTPExceptionProps) {
    super(props)
  }
}

export class SystemWorkItemHttpError extends SystemHTTPException {
  constructor(error: SystemWorkItemError) {
    const statuses = {
      invalid: 400,
      forbidden: 403,
      not_found: 404,
      conflict: 409,
      unavailable: 503,
    } as const
    super({
      status: statuses[error.kind],
      code: error.message,
      detail: error.message,
      cause: error,
    })
  }
}

export abstract class OIDCHTTPException extends SystemHTTPException {
  readonly allow: string | null
  readonly authenticate: string | null

  constructor(props: {
    code: OIDCHTTPExceptionCode
    status?: 400 | 401 | 404 | 405 | 503
    allow?: string
    authenticate?: string
    cause?: unknown
  }) {
    super({
      status: props.status ?? 400,
      code: props.code,
      detail: props.code,
      ...(props.cause === undefined ? {} : { cause: props.cause }),
    })
    this.allow = props.allow ?? null
    this.authenticate = props.authenticate ?? null
  }
}

export class OIDCInvalidGrantError extends OIDCHTTPException {
  constructor(cause?: unknown) {
    super({ code: "invalid_grant", cause })
  }
}

export class OIDCInvalidRequestError extends OIDCHTTPException {
  constructor(cause?: unknown) {
    super({ code: "invalid_request", cause })
  }
}

export class OIDCInvalidScopeError extends OIDCHTTPException {
  constructor(cause?: unknown) {
    super({ code: "invalid_scope", cause })
  }
}

export class OIDCInvalidTokenError extends OIDCHTTPException {
  constructor(cause?: unknown) {
    super({
      code: "invalid_token",
      status: 401,
      authenticate: 'Bearer error="invalid_token"',
      cause,
    })
  }
}

export class OIDCMetadataNotFoundError extends OIDCHTTPException {
  constructor(cause?: unknown) {
    super({ code: "not_found", status: 404, cause })
  }
}

export class OIDCMethodNotAllowedError extends OIDCHTTPException {
  constructor() {
    super({ code: "method_not_allowed", status: 405, allow: "GET, HEAD" })
  }
}

export class OIDCTemporarilyUnavailableError extends OIDCHTTPException {
  constructor(cause?: unknown) {
    super({ code: "temporarily_unavailable", status: 503, cause })
  }
}

export class SystemAccountConflictError extends SystemHTTPException {
  constructor() {
    super({ status: 409, code: "account_conflict", detail: "account conflict" })
  }
}

export class SystemAccountNotFoundError extends SystemHTTPException {
  constructor() {
    super({ status: 404, code: "account_not_found", detail: "account not found" })
  }
}

export class SystemAccountUnavailableError extends SystemHTTPException {
  constructor() {
    super({ status: 503, code: "account_unavailable", detail: "account service unavailable" })
  }
}

export class SystemAlreadyInitializedError extends SystemHTTPException {
  constructor() {
    super({ status: 409, code: "already_initialized", detail: "already initialized" })
  }
}

export class SystemApplicationError extends SystemHTTPException {
  constructor(error: SystemApplicationFailure) {
    const { error: code, message: detail, ...metadata } = error.body
    super({
      status: error.status,
      code,
      detail,
      metadata,
      cause: error,
    })
  }
}

export class SystemAttachmentFileRequiredError extends SystemHTTPException {
  constructor() {
    super({ status: 400, code: "attachment_file_required", detail: "file field is required" })
  }
}

export class SystemAttachmentInternalError extends SystemHTTPException {
  constructor(props: { code: string; detail: string; cause?: unknown }) {
    super({ status: 500, ...props })
  }
}

export class SystemAttachmentNotFoundError extends SystemHTTPException {
  constructor() {
    super({ status: 404, code: "attachment_not_found", detail: "attachment not found" })
  }
}

export class SystemAttachmentNotPendingError extends SystemHTTPException {
  constructor() {
    super({
      status: 404,
      code: "attachment_not_pending",
      detail: "attachment is linked to a record",
    })
  }
}

export class SystemAttachmentPurgeUnavailableError extends SystemHTTPException {
  constructor(cause?: unknown) {
    super({
      status: 503,
      code: "attachment_purge_unavailable",
      detail: "attachment purge unavailable",
      cause,
    })
  }
}

export class SystemAttachmentReadError extends SystemHTTPException {
  constructor(props: { code: string; detail: string; unavailable?: boolean; cause?: unknown }) {
    super({ status: props.unavailable === true ? 503 : 404, ...props })
  }
}

export class SystemAttachmentUnavailableError extends SystemHTTPException {
  constructor(props: { code?: string; detail?: string; cause?: unknown } = {}) {
    super({
      status: 503,
      code: props.code ?? "attachment_unavailable",
      detail: props.detail ?? "attachment service unavailable",
      cause: props.cause,
    })
  }
}

export class SystemAttachmentValidationError extends SystemHTTPException {
  constructor(props: { code: string; detail: string; payloadTooLarge?: boolean; cause?: unknown }) {
    super({
      status: props.payloadTooLarge === true ? 413 : 400,
      code: props.code,
      detail: props.detail,
      cause: props.cause,
    })
  }
}

export class SystemAuditEventNotFoundError extends SystemHTTPException {
  constructor() {
    super({ status: 404, code: "audit_event_not_found", detail: "audit event not found" })
  }
}

export class SystemAuditUnavailableError extends SystemHTTPException {
  constructor() {
    super({ status: 503, code: "audit_unavailable", detail: "audit service unavailable" })
  }
}

export class SystemBatchUnavailableError extends SystemHTTPException {
  constructor(cause?: unknown) {
    super({
      status: 503,
      code: "batch_unavailable",
      detail: "batch job history is unavailable",
      cause,
    })
  }
}

export class SystemAuthenticationRateLimitedError extends SystemHTTPException {
  constructor() {
    super({ status: 429, code: "authentication_rate_limited", detail: "too many requests" })
  }
}

export class SystemAuthenticationRequiredError extends SystemHTTPException {
  constructor() {
    super({
      status: 401,
      code: "authentication_required",
      detail: "authentication required",
    })
  }
}

export class SystemBootstrapCredentialInvalidError extends SystemHTTPException {
  constructor() {
    super({ status: 401, code: "invalid_credential", detail: "invalid bootstrap credential" })
  }
}

export class SystemBootstrapInputInvalidError extends SystemHTTPException {
  constructor(code: string) {
    super({ status: 400, code, detail: "invalid bootstrap input" })
  }
}

export class SystemBootstrapUnavailableError extends SystemHTTPException {
  constructor() {
    super({ status: 503, code: "bootstrap_unavailable", detail: "bootstrap service unavailable" })
  }
}

export class SystemBrowserLoginCodeUnavailableError extends SystemHTTPException {
  constructor() {
    super({
      status: 503,
      code: "browser_login_code_unavailable",
      detail: "browser login is unavailable",
    })
  }
}

export class SystemCLIAuthorizationInvalidError extends SystemHTTPException {
  constructor() {
    super({ status: 401, code: "invalid_cli_authorization", detail: "invalid CLI authorization" })
  }
}

export class SystemCLICodeInvalidError extends SystemHTTPException {
  constructor() {
    super({ status: 401, code: "invalid_cli_code", detail: "invalid CLI code" })
  }
}

export class SystemCLILoginUnavailableError extends SystemHTTPException {
  constructor() {
    super({ status: 503, code: "cli_login_unavailable", detail: "CLI login is unavailable" })
  }
}

export class SystemCredentialsInvalidError extends SystemHTTPException {
  constructor() {
    super({ status: 401, code: "invalid_credentials", detail: "invalid credentials" })
  }
}

export class SystemProposalHistoryUnavailableError extends SystemHTTPException {
  constructor() {
    super({
      status: 503,
      code: "proposal_history_unavailable",
      detail: "提案履歴の閲覧資格・整合性・開示監査を確認できません",
    })
  }
}

export class SystemForbiddenError extends SystemHTTPException {
  constructor() {
    super({ status: 403, code: "forbidden", detail: "forbidden" })
  }
}

export class SystemIAMUnavailableError extends SystemHTTPException {
  constructor() {
    super({ status: 503, code: "iam_unavailable", detail: "IAM service unavailable" })
  }
}

export class SystemIdentityConflictError extends SystemHTTPException {
  constructor() {
    super({ status: 409, code: "identity_conflict", detail: "identity conflict" })
  }
}

export class SystemIdentityInvalidError extends SystemHTTPException {
  constructor() {
    super({ status: 400, code: "invalid_identity", detail: "invalid identity" })
  }
}

export class SystemIdentityLoginDeniedError extends SystemHTTPException {
  constructor() {
    super({ status: 401, code: "identity_login_denied", detail: "identity login denied" })
  }
}

export class SystemIdentityLoginUnavailableError extends SystemHTTPException {
  constructor() {
    super({
      status: 503,
      code: "identity_login_unavailable",
      detail: "identity login is unavailable",
    })
  }
}

export class SystemIdentityNotFoundError extends SystemHTTPException {
  constructor() {
    super({ status: 404, code: "identity_not_found", detail: "identity not found" })
  }
}

export class SystemIdentityUnavailableError extends SystemHTTPException {
  constructor() {
    super({ status: 503, code: "identity_unavailable", detail: "identity service unavailable" })
  }
}

export class SystemIntegrationInvalidError extends SystemHTTPException {
  constructor(cause?: unknown) {
    super({
      status: 400,
      code: "integration_invalid",
      detail: "integration input is invalid",
      cause,
    })
  }
}

export class SystemIntegrationConflictError extends SystemHTTPException {
  constructor() {
    super({ status: 409, code: "integration_conflict", detail: "integration conflict" })
  }
}

export class SystemIntegrationNotFoundError extends SystemHTTPException {
  constructor() {
    super({ status: 404, code: "integration_not_found", detail: "integration record not found" })
  }
}

export class SystemIntegrationUnavailableError extends SystemHTTPException {
  constructor(cause?: unknown) {
    super({
      status: 503,
      code: "integration_unavailable",
      detail: "integration service unavailable",
      cause,
    })
  }
}

export class SystemPrincipalConflictError extends SystemHTTPException {
  constructor() {
    super({ status: 409, code: "principal_conflict", detail: "principal conflict" })
  }
}

export class SystemPrincipalInvalidError extends SystemHTTPException {
  constructor(cause?: unknown) {
    super({ status: 400, code: "principal_invalid", detail: "principal input is invalid", cause })
  }
}

export class SystemPrincipalNotFoundError extends SystemHTTPException {
  constructor() {
    super({ status: 404, code: "principal_not_found", detail: "principal not found" })
  }
}

export class SystemPrincipalUnavailableError extends SystemHTTPException {
  constructor(cause?: unknown) {
    super({ status: 503, code: "principal_unavailable", detail: "principal unavailable", cause })
  }
}

export class SystemStepUpRequiredError extends SystemHTTPException {
  constructor() {
    super({ status: 403, code: "step_up_required", detail: "step-up authentication required" })
  }
}

export class SystemDeliveryConflictError extends SystemHTTPException {
  constructor() {
    super({ status: 409, code: "delivery_conflict", detail: "delivery conflict" })
  }
}

export class SystemDeliveryInvalidError extends SystemHTTPException {
  constructor(cause?: unknown) {
    super({ status: 400, code: "delivery_invalid", detail: "delivery input is invalid", cause })
  }
}

export class SystemDeliveryNotFoundError extends SystemHTTPException {
  constructor() {
    super({ status: 404, code: "delivery_not_found", detail: "delivery not found" })
  }
}

export class SystemDeliveryUnavailableError extends SystemHTTPException {
  constructor(cause?: unknown) {
    super({ status: 503, code: "delivery_unavailable", detail: "delivery unavailable", cause })
  }
}

export class SystemInternalServerError extends SystemHTTPException {
  constructor(cause: unknown) {
    super({
      status: 500,
      code: "internal_server_error",
      detail: "処理に失敗しました。",
      cause,
    })
  }
}

export class SystemInvalidSessionError extends SystemHTTPException {
  constructor() {
    super({ status: 401, code: "invalid_session", detail: "invalid session" })
  }
}

export class SystemLastActiveIdentityError extends SystemHTTPException {
  constructor() {
    super({ status: 409, code: "last_active_identity", detail: "last active identity" })
  }
}

export class SystemLastRootAccountError extends SystemHTTPException {
  constructor() {
    super({ status: 409, code: "last_root", detail: "last root account" })
  }
}

export class SystemLastRootBindingError extends SystemHTTPException {
  constructor() {
    super({ status: 409, code: "last_root", detail: "last root binding" })
  }
}

export class SystemLastRootIdentityError extends SystemHTTPException {
  constructor() {
    super({ status: 409, code: "last_root", detail: "last root identity" })
  }
}

export class SystemLoginCodeInvalidError extends SystemHTTPException {
  constructor() {
    super({ status: 401, code: "invalid_login_code", detail: "invalid or expired code" })
  }
}

export class SystemManagedRoleImmutableError extends SystemHTTPException {
  constructor() {
    super({ status: 409, code: "managed_role", detail: "managed role is immutable" })
  }
}

export class SystemNotFoundError extends SystemHTTPException {
  constructor() {
    super({ status: 404, code: "not_found", detail: "not found" })
  }
}

export class SystemNotificationInvalidError extends SystemHTTPException {
  constructor() {
    super({ status: 400, code: "invalid_notification", detail: "invalid notification" })
  }
}

export class SystemNotificationNotFoundError extends SystemHTTPException {
  constructor() {
    super({ status: 404, code: "notification_not_found", detail: "notification not found" })
  }
}

export class SystemNotificationRecipientNotFoundError extends SystemHTTPException {
  constructor() {
    super({
      status: 404,
      code: "notification_recipient_not_found",
      detail: "notification recipient not found",
    })
  }
}

export class SystemNotificationTransitionInvalidError extends SystemHTTPException {
  constructor() {
    super({
      status: 409,
      code: "invalid_notification_transition",
      detail: "invalid notification transition",
    })
  }
}

export class SystemNotificationUnavailableError extends SystemHTTPException {
  constructor() {
    super({
      status: 503,
      code: "notification_unavailable",
      detail: "notification service unavailable",
    })
  }
}

export class SystemPasswordCredentialNotFoundError extends SystemHTTPException {
  constructor() {
    super({
      status: 404,
      code: "password_credential_not_found",
      detail: "password credential not found",
    })
  }
}

export class SystemPasswordInvalidError extends SystemHTTPException {
  constructor() {
    super({ status: 400, code: "invalid_password", detail: "invalid password" })
  }
}

export class SystemPasswordUnavailableError extends SystemHTTPException {
  constructor() {
    super({ status: 503, code: "password_unavailable", detail: "password service unavailable" })
  }
}

export class SystemRoleBindingConflictError extends SystemHTTPException {
  constructor() {
    super({ status: 409, code: "role_binding_conflict", detail: "role binding conflict" })
  }
}

export class SystemRoleBindingInvalidError extends SystemHTTPException {
  constructor() {
    super({ status: 400, code: "invalid_role_binding", detail: "invalid role binding" })
  }
}

export class SystemRoleBindingNotFoundError extends SystemHTTPException {
  constructor() {
    super({ status: 404, code: "role_binding_not_found", detail: "role binding not found" })
  }
}

export class SystemRoleConflictError extends SystemHTTPException {
  constructor() {
    super({ status: 409, code: "role_conflict", detail: "role conflict" })
  }
}

export class SystemRoleInUseError extends SystemHTTPException {
  constructor() {
    super({ status: 409, code: "role_in_use", detail: "role is in use" })
  }
}

export class SystemRoleInvalidError extends SystemHTTPException {
  constructor() {
    super({ status: 400, code: "invalid_role", detail: "invalid role" })
  }
}

export class SystemRoleNotFoundError extends SystemHTTPException {
  constructor() {
    super({ status: 404, code: "role_not_found", detail: "role not found" })
  }
}

export class SystemSelfAssignmentForbiddenError extends SystemHTTPException {
  constructor() {
    super({ status: 403, code: "self_assignment", detail: "self assignment is forbidden" })
  }
}

export class SystemSessionUnavailableError extends SystemHTTPException {
  constructor(cause?: unknown) {
    super({
      status: 503,
      code: "session_unavailable",
      detail: "session service unavailable",
      ...(cause === undefined ? {} : { cause }),
    })
  }
}

export class SystemPreservedRecordNotAttachmentError extends SystemHTTPException {
  constructor() {
    super({
      status: 400,
      code: "record_is_not_attachment",
      detail: "The preserved record is not an attachment",
    })
  }
}

export class SystemPreservedRecordUnavailableError extends SystemHTTPException {
  constructor() {
    super({
      status: 503,
      code: "preserved_record_unavailable",
      detail: "保全記録の整合性・閲覧資格・開示監査を確認できません",
    })
  }
}
