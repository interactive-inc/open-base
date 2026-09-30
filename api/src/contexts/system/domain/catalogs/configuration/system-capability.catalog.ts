export const SYSTEM_CAPABILITY_NAMES = [
  "attachments",
  "audit",
  "auth",
  "batch",
  "configuration",
  "events",
  "http",
  "iam",
  "idempotency",
  "identity",
  "integration",
  "notifications",
  "oauth",
  "records",
  "work",
  "workflow",
] as const

export type SystemCapabilityName = (typeof SYSTEM_CAPABILITY_NAMES)[number]

export const REQUIRED_SYSTEM_CAPABILITY_NAMES = [
  "audit",
  "auth",
  "configuration",
  "http",
  "iam",
  "identity",
] as const satisfies ReadonlyArray<SystemCapabilityName>

Object.freeze(SYSTEM_CAPABILITY_NAMES)
Object.freeze(REQUIRED_SYSTEM_CAPABILITY_NAMES)
