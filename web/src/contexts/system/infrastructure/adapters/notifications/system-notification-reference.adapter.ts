import type { SystemDatabase } from "@system/configuration/system-context"
import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import {
  systemNotificationDeliveries as deliveries,
  systemNotificationMessages as messages,
  systemNotificationResourceScopes as scopes,
} from "@system/infrastructure/schema/system-core"
import { and, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm"

/** 可視性の判定に使う配信と不透明な操作・範囲の参照。本文は含めない。 */
export type SystemNotificationReference = Readonly<{
  id: string
  actionUrl: string | null
  actionType: string | null
  actionId: string | null
  resourceScope: Readonly<{ type: string; id: string }> | null
}>

/** 不透明な参照の読み取りと、一致する配信の非表示を扱う。 */
type Context = Readonly<{ database: SystemDatabase }>

export class SystemNotificationReferenceAdapter {
  constructor(private readonly c: Context) {}

  async findMany(
    input: Readonly<{
      recipientAccountId: AccountId
      read?: boolean
      deliveryId?: string
    }>,
  ): Promise<ReadonlyArray<SystemNotificationReference> | Error> {
    try {
      const records = await this.c.database
        .select({
          id: deliveries.id,
          actionUrl: messages.actionUrl,
          actionType: messages.actionType,
          actionId: messages.actionId,
          resourceScope: { type: scopes.resourceType, id: scopes.resourceId },
        })
        .from(deliveries)
        .innerJoin(messages, eq(messages.id, deliveries.messageId))
        .leftJoin(scopes, eq(scopes.messageId, messages.id))
        .where(
          and(
            eq(deliveries.recipientAccountId, input.recipientAccountId),
            isNull(deliveries.dismissedAt),
            input.read === undefined
              ? undefined
              : input.read
                ? isNotNull(deliveries.readAt)
                : isNull(deliveries.readAt),
            input.deliveryId === undefined ? undefined : eq(deliveries.id, input.deliveryId),
          ),
        )
      return Object.freeze(records)
    } catch (cause) {
      return cause instanceof Error
        ? cause
        : new Error("failed to list System Notification references")
    }
  }

  write(
    input: Readonly<{
      sourceType: string
      resourceScope: Readonly<{ type: string; id: string }>
      dismissedAt: Date
    }>,
  ) {
    const selected = this.c.database
      .select({ id: messages.id })
      .from(messages)
      .innerJoin(scopes, eq(scopes.messageId, messages.id))
      .where(
        and(
          eq(messages.sourceType, input.sourceType),
          eq(scopes.resourceType, input.resourceScope.type),
          eq(scopes.resourceId, input.resourceScope.id),
        ),
      )
    return this.c.database
      .update(deliveries)
      .set({ dismissedAt: sql`max(${input.dismissedAt.getTime()}, ${deliveries.deliveredAt})` })
      .where(and(isNull(deliveries.dismissedAt), inArray(deliveries.messageId, selected)))
  }
}
