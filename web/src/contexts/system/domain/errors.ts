export type SystemAuditJsonErrorCode = "invalid_json" | "payload_too_large"

export type SystemAttachmentErrorKind =
  | "not_found"
  | "payload_too_large"
  | "unexpected"
  | "unprocessable"
  | "unavailable"
  | "validation"

export function toSystemAuditJsonErrorMessage(code: SystemAuditJsonErrorCode): string {
  return code === "payload_too_large"
    ? "system audit JSON exceeds the 64 KiB limit"
    : "system audit JSON contains an unsupported value"
}

export const invalidAccountReasons = Object.freeze([
  "account_closed",
  "invalid_closed_state",
  "invalid_shape",
  "token_version_exhausted",
  "transition_before_last_update",
  "update_before_creation",
] as const)

export type InvalidAccountReason = (typeof invalidAccountReasons)[number]

export const invalidSessionReasons = Object.freeze([
  "authentication_after_creation",
  "expiration_not_after_creation",
  "expired",
  "invalid_clock",
  "invalid_rotation_successor",
  "invalid_shape",
  "not_yet_valid",
  "revocation_before_creation",
  "revocation_before_rotation",
  "revoked",
  "rotated",
  "rotation_at_or_after_expiration",
  "rotation_before_creation",
  "transition_before_last_update",
] as const)

export type InvalidSessionReason = (typeof invalidSessionReasons)[number]

export type SystemCapabilityActivationProblem = Readonly<{
  code:
    | "capability_not_implemented"
    | "duplicate_enabled_capability"
    | "duplicate_implemented_capability"
    | "invalid_activation_shape"
    | "missing_required_activation"
    | "missing_required_implementation"
    | "unknown_enabled_capability"
    | "unknown_implemented_capability"
  capability: string | null
}>

export const invalidIamGraphReasons = Object.freeze([
  "duplicate_binding_id",
  "duplicate_role_id",
  "invalid_shape",
  "unknown_binding_role",
] as const)

export type InvalidIamGraphReason = (typeof invalidIamGraphReasons)[number]

export type InvalidOidcScopeReason = "invalid_scope" | "openid_scope_required" | "unsupported_scope"

export const invalidIamRoleReasons = Object.freeze([
  "duplicate_permissions",
  "invalid_shape",
  "managed_role_mutation",
  "permissions_not_sorted",
  "update_before_creation",
  "update_before_last_update",
] as const)

export type InvalidIamRoleReason = (typeof invalidIamRoleReasons)[number]

export const invalidRoleBindingReasons = Object.freeze([
  "invalid_shape",
  "revocation_before_creation",
  "transition_before_last_update",
] as const)

export type InvalidRoleBindingReason = (typeof invalidRoleBindingReasons)[number]

export const invalidIdentityBindingReasons = Object.freeze([
  "activation_before_creation",
  "invalid_shape",
  "revocation_before_activation",
  "revocation_before_creation",
  "revoked_identity_activation",
] as const)

export type InvalidIdentityBindingReason = (typeof invalidIdentityBindingReasons)[number]

export const invalidNotificationDeliveryBatchReasons = Object.freeze([
  "duplicate_delivery_id",
  "duplicate_message_recipient",
  "invalid_shape",
] as const)

export type InvalidNotificationDeliveryBatchReason =
  (typeof invalidNotificationDeliveryBatchReasons)[number]

export const invalidNotificationDeliveryReasons = Object.freeze([
  "invalid_shape",
  "read_before_delivery",
  "dismiss_before_delivery",
  "dismissed",
  "transition_before_last_update",
] as const)

export type InvalidNotificationDeliveryReason = (typeof invalidNotificationDeliveryReasons)[number]

export const invalidNotificationMessageReasons = Object.freeze(["invalid_shape"] as const)

export type InvalidNotificationMessageReason = (typeof invalidNotificationMessageReasons)[number]

export type InvalidSystemProposalCode =
  | "digest_mismatch"
  | "invalid_chronology"
  | "invalid_json"
  | "invalid_shape"
  | "payload_too_large"

export const invalidSystemWorkflowReasons = Object.freeze([
  "invalid_shape",
  "invalid_chronology",
  "invalid_transition",
  "duplicate_candidate",
  "candidate_excluded",
  "attestation_mismatch",
  "duplicate_attestation",
  "ineligible_decider",
  "decision_pending",
  "delegation_to_self",
  "authorization_expired",
  "authorization_already_used",
  "proposal_digest_mismatch",
] as const)

export type InvalidSystemWorkflowReason = (typeof invalidSystemWorkflowReasons)[number]

export type InvalidSystemPasswordReason = "password_too_long" | "password_too_short"

export type InvalidSystemAccessTokenSecretReason = "missing" | "placeholder" | "too_short"

export type InvalidSystemIntegrationReason =
  | "duplicate_item"
  | "invalid_shape"
  | "invalid_transition"
  | "update_before_creation"
  | "update_before_last_update"

export type InvalidSystemPrincipalReason =
  | "invalid_shape"
  | "invalid_subject"
  | "invalid_transition"
  | "update_before_creation"
  | "update_before_last_update"

export type InvalidSystemDeliveryReason =
  | "invalid_shape"
  | "invalid_transition"
  | "lease_mismatch"
  | "outside_lease"
  | "update_before_creation"
  | "update_before_last_update"

/** Domain層で予想可能な業務エラーの共通基底。 */
export class DomainError extends Error {
  readonly layer = "domain"

  constructor(message: string, options: ErrorOptions = {}) {
    super(message, options)
    this.name = new.target.name
  }
}

export class InvalidAccountError extends DomainError {
  readonly code = "invalid_account" as const

  constructor(
    readonly reason: InvalidAccountReason,
    cause?: unknown,
  ) {
    super("invalid_account", { cause })
    this.name = "InvalidAccountError"
    Object.freeze(this)
  }
}

export class InvalidEmailError extends DomainError {
  readonly code = "invalid_email" as const

  constructor() {
    super("invalid_email")
    this.name = "InvalidEmailError"
    Object.freeze(this)
  }
}

export class InvalidIamGraphError extends DomainError {
  readonly code = "invalid_iam_graph" as const

  constructor(readonly reason: InvalidIamGraphReason) {
    super("invalid_iam_graph")
    this.name = "InvalidIamGraphError"
    Object.freeze(this)
  }
}

export class InvalidIamRoleError extends DomainError {
  readonly code = "invalid_iam_role" as const

  constructor(
    readonly reason: InvalidIamRoleReason,
    cause?: unknown,
  ) {
    super("invalid_iam_role", { cause })
    this.name = "InvalidIamRoleError"
    Object.freeze(this)
  }
}

export class InvalidIdentityBindingError extends DomainError {
  readonly code = "invalid_identity_binding" as const

  constructor(
    readonly reason: InvalidIdentityBindingReason,
    cause?: unknown,
  ) {
    super("invalid_identity_binding", { cause })
    this.name = "InvalidIdentityBindingError"
    Object.freeze(this)
  }
}

export class InvalidMcpRedirectUriConfigurationError extends DomainError {
  readonly code = "invalid_mcp_redirect_uri_configuration"

  constructor() {
    super("MCP redirect URI configuration is not canonical")
    this.name = "InvalidMcpRedirectUriConfigurationError"
  }
}

export class InvalidNotificationDeliveryBatchError extends DomainError {
  readonly code = "invalid_notification_delivery_batch" as const

  constructor(
    readonly reason: InvalidNotificationDeliveryBatchReason,
    cause?: unknown,
  ) {
    super("invalid_notification_delivery_batch", { cause })
    this.name = "InvalidNotificationDeliveryBatchError"
    Object.freeze(this)
  }
}

export class InvalidNotificationDeliveryError extends DomainError {
  readonly code = "invalid_notification_delivery" as const

  constructor(
    readonly reason: InvalidNotificationDeliveryReason,
    cause?: unknown,
  ) {
    super("invalid_notification_delivery", { cause })
    this.name = "InvalidNotificationDeliveryError"
    Object.freeze(this)
  }
}

export class InvalidNotificationMessageError extends DomainError {
  readonly code = "invalid_notification_message" as const

  constructor(
    readonly reason: InvalidNotificationMessageReason,
    cause?: unknown,
  ) {
    super("invalid_notification_message", { cause })
    this.name = "InvalidNotificationMessageError"
    Object.freeze(this)
  }
}

export class InvalidOidcClientRegistryError extends DomainError {
  readonly code = "invalid_oidc_client_registry"

  constructor() {
    super("OIDC client registry is not canonical")
    this.name = "InvalidOidcClientRegistryError"
  }
}

export class InvalidOidcIssuerError extends DomainError {
  readonly code = "invalid_oidc_issuer" as const

  constructor() {
    super("unknown_oidc_issuer")
    this.name = "InvalidOidcIssuerError"
    Object.freeze(this)
  }
}

export class InvalidOidcScopeError extends DomainError {
  readonly code = "invalid_oidc_scope" as const

  constructor(readonly reason: InvalidOidcScopeReason) {
    super(reason)
    this.name = "InvalidOidcScopeError"
    Object.freeze(this)
  }
}

export class InvalidRoleBindingError extends DomainError {
  readonly code = "invalid_role_binding" as const

  constructor(
    readonly reason: InvalidRoleBindingReason,
    cause?: unknown,
  ) {
    super("invalid_role_binding", { cause })
    this.name = "InvalidRoleBindingError"
    Object.freeze(this)
  }
}

export class InvalidSessionError extends DomainError {
  readonly code = "invalid_session" as const

  constructor(
    readonly reason: InvalidSessionReason,
    cause?: unknown,
  ) {
    super("invalid_session", { cause })
    this.name = "InvalidSessionError"
    Object.freeze(this)
  }
}

export class InvalidSystemAccessTokenSecretError extends DomainError {
  readonly code = "invalid_system_access_token_secret" as const

  constructor(readonly reason: InvalidSystemAccessTokenSecretReason) {
    super(reason)
    this.name = "InvalidSystemAccessTokenSecretError"
    Object.freeze(this)
  }
}

export class InvalidSystemAuditEventError extends DomainError {
  readonly code = "invalid_system_audit_event"

  constructor(cause?: unknown) {
    super("System audit event is not canonical", cause === undefined ? {} : { cause })
    this.name = "InvalidSystemAuditEventError"
  }
}

export class InvalidSystemCapabilityActivationError extends DomainError {
  readonly code = "invalid_system_capability_activation" as const
  readonly problems: ReadonlyArray<SystemCapabilityActivationProblem>

  constructor(problems: ReadonlyArray<SystemCapabilityActivationProblem>) {
    super("invalid_system_capability_activation")
    this.name = "InvalidSystemCapabilityActivationError"
    this.problems = Object.freeze(problems.map((problem) => Object.freeze({ ...problem })))
    Object.freeze(this)
  }
}

export class InvalidSystemCliIdentityRedirectUriError extends DomainError {
  readonly code = "invalid_system_cli_identity_redirect_uri" as const

  constructor() {
    super("invalid_system_cli_identity_redirect_uri")
    this.name = "InvalidSystemCliIdentityRedirectUriError"
    Object.freeze(this)
  }
}

export class InvalidSystemPasswordError extends DomainError {
  readonly code = "invalid_system_password" as const

  constructor(readonly reason: InvalidSystemPasswordReason) {
    super(reason)
    this.name = "InvalidSystemPasswordError"
    Object.freeze(this)
  }
}

export class InvalidSystemProposalError extends DomainError {
  readonly code: InvalidSystemProposalCode

  constructor(code: InvalidSystemProposalCode, options?: ErrorOptions) {
    super(code, options)
    this.name = "InvalidSystemProposalError"
    this.code = code
  }
}

export class InvalidSystemWorkflowError extends DomainError {
  readonly code = "invalid_system_workflow"

  constructor(
    readonly reason: InvalidSystemWorkflowReason,
    cause?: unknown,
  ) {
    super("invalid_system_workflow", { cause })
    this.name = "InvalidSystemWorkflowError"
    Object.freeze(this)
  }
}

export class InvalidSystemIntegrationError extends DomainError {
  readonly code = "invalid_system_integration" as const

  constructor(
    readonly reason: InvalidSystemIntegrationReason,
    cause?: unknown,
  ) {
    super("invalid_system_integration", { cause })
    this.name = "InvalidSystemIntegrationError"
    Object.freeze(this)
  }
}

export class InvalidSystemPrincipalError extends DomainError {
  readonly code = "invalid_system_principal" as const

  constructor(
    readonly reason: InvalidSystemPrincipalReason,
    cause?: unknown,
  ) {
    super("invalid_system_principal", { cause })
    this.name = "InvalidSystemPrincipalError"
    Object.freeze(this)
  }
}

export class InvalidSystemDeliveryError extends DomainError {
  readonly code = "invalid_system_delivery" as const

  constructor(
    readonly reason: InvalidSystemDeliveryReason,
    cause?: unknown,
  ) {
    super("invalid_system_delivery", { cause })
    this.name = "InvalidSystemDeliveryError"
    Object.freeze(this)
  }
}

export class SystemAttachmentError extends DomainError {
  constructor(
    readonly kind: SystemAttachmentErrorKind,
    readonly code: string,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = "SystemAttachmentError"
    Object.freeze(this)
  }
}

export class SystemAuditDisclosureError extends DomainError {
  constructor(
    readonly kind: "invalid" | "conflict" | "forbidden" | "unavailable",
    cause?: unknown,
  ) {
    super(`audit_disclosure_${kind}`, { cause })
    this.name = "SystemAuditDisclosureError"
    Object.freeze(this)
  }
}

export class SystemWorkItemError extends DomainError {
  constructor(
    readonly kind: "invalid" | "conflict" | "forbidden" | "not_found" | "unavailable",
    cause?: unknown,
  ) {
    super(`work_item_${kind}`, { cause })
    this.name = "SystemWorkItemError"
    Object.freeze(this)
  }
}

export class SystemAuditJsonError extends DomainError {
  readonly code: SystemAuditJsonErrorCode

  constructor(code: SystemAuditJsonErrorCode, options?: ErrorOptions) {
    super(toSystemAuditJsonErrorMessage(code), options)
    this.name = "SystemAuditJsonError"
    this.code = code
    Object.freeze(this)
  }
}

/** 保全記録の個別開示設定が対象・主体・操作・用途を許可していない。 */
export class PreservedRecordDisclosureDeniedError extends DomainError {
  constructor() {
    super("preserved record disclosure is not permitted")
  }
}
