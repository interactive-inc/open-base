import type { SystemDatabase } from "@system/configuration/system-context"
import { SystemNotificationReferenceAdapter } from "@system/infrastructure/adapters/notifications/system-notification-reference.adapter"

/** 参照に一致する配信を非表示にする文。実行時に選ぶため、事前収集後の追加も対象になる。 */
export function prepareSystemNotificationReferenceDismissal(
  input: Readonly<{
    database: SystemDatabase
    sourceType: string
    resourceScope: Readonly<{ type: string; id: string }>
    dismissedAt: Date
  }>,
) {
  return new SystemNotificationReferenceAdapter({ database: input.database }).write(input)
}
