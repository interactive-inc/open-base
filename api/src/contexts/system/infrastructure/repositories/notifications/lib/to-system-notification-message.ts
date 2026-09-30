import { NotificationMessageEntity } from "@system/domain/entities/notification-message.entity"

/** untrustedなD1 rowをcanonical Notification Messageへfail closedに変換する。 */
export function toSystemNotificationMessage(row: unknown): NotificationMessageEntity | Error {
  if (typeof row !== "object" || row === null || Array.isArray(row)) {
    return new Error("System Notification Message row is invalid")
  }
  const record = row as Record<string, unknown>

  return NotificationMessageEntity.create({
    id: record.id,
    kind: record.kind,
    title: record.title,
    body: record.body,
    source:
      record.source_type === null && record.source_id === null
        ? null
        : { type: record.source_type, id: record.source_id },
    action:
      record.action_type == null && record.action_id == null
        ? null
        : { type: record.action_type, id: record.action_id },
    resourceScope:
      record.resource_type == null && record.resource_id == null
        ? null
        : { type: record.resource_type, id: record.resource_id },
    priority: record.priority ?? "normal",
    publicationKey: record.dedupe_key ?? null,
    createdAt:
      typeof record.created_at === "number" ? new Date(record.created_at) : record.created_at,
  })
}
