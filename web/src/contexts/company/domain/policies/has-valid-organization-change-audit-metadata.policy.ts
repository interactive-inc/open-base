import type { OrganizationChangeSet } from "@/contexts/company/domain/definitions/organization-change.definition"

export function hasValidOrganizationChangeAuditMetadata(change: OrganizationChangeSet): boolean {
  const actorIsValid =
    change.actorAccountId.length >= 1 &&
    change.actorAccountId.length <= 255 &&
    change.actorAccountId.trim() === change.actorAccountId
  const reasonIsValid =
    change.reason.length >= 1 &&
    change.reason.length <= 1_000 &&
    change.reason.trim() === change.reason
  const evidenceIsValid = change.evidenceReferences.every(
    (reference) =>
      reference.context.length >= 1 &&
      reference.context.length <= 100 &&
      reference.context.trim() === reference.context &&
      reference.kind.length >= 1 &&
      reference.kind.length <= 100 &&
      reference.kind.trim() === reference.kind &&
      reference.id.length >= 1 &&
      reference.id.length <= 512 &&
      reference.id.trim() === reference.id &&
      reference.version.length >= 1 &&
      reference.version.length <= 255 &&
      reference.version.trim() === reference.version,
  )
  return actorIsValid && reasonIsValid && change.evidenceReferences.length <= 100 && evidenceIsValid
}
