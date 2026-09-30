import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import type { CompanyNotificationKind } from "@/api/http/notifications/notification-kind.definition"
import type { Context } from "@/env"
import { resolveCompanyAccountEmployeeLink } from "@/contexts/company/interface/operations/resolve-company-account-employee-link"
import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { SystemAccountEligibilityAdapter } from "@/api/http/accounts/system-account-eligibility.adapter"
import { prepareSystemNotificationPublicationBatch } from "@system/interface/operations/prepare-system-notification-publication-batch"
import { zAccountId, type AccountId } from "@system/domain/schemas/iam/account-id.schema"

export type EmployeeNotification = Readonly<{
  recipientEmployeeId: EmployeeId
  kind: CompanyNotificationKind
  title: string
  body: string | null
  sourceDomain: string
  sourceId: string | number | null
  createdAt: string
}>

export type PublishedEmployeeNotification = Readonly<{
  id: string
  recipientAccountId: AccountId
  sourceDomain: string
  sourceId: string | number | null
  kind: CompanyNotificationKind
  title: string
  body: string | null
  isRead: false
  createdAt: string
}>

/** Company の Employee 宛て要求を System の Account 宛て通知へ変換する。 */
export class EmployeeNotificationAdapter {
  constructor(private readonly c: Context) {}

  /**
   * `guards` は通知と同じbatchで先に評価する条件文。業務の書込み停止などで条件が失敗すると、
   * 通知と配送は一つも保存されない。
   */
  async create(
    props: EmployeeNotification,
    options: Readonly<{ guards?: ReadonlyArray<D1PreparedStatement> }> = {},
  ): Promise<PublishedEmployeeNotification | Error> {
    const resolved = await resolveCompanyAccountEmployeeLink(
      this.c,
      new SystemAccountEligibilityAdapter(this.c.env.DB),
      { kind: "by_employee", employeeId: toWorkforceEmployeeId(props.recipientEmployeeId) },
    )
    if (resolved.kind !== "found") {
      return new Error(`notification recipient account link is ${resolved.kind}`, {
        cause: resolved.kind === "unavailable" ? resolved.cause : undefined,
      })
    }

    const recipientAccountId = zAccountId.safeParse(resolved.link.accountId)
    if (!recipientAccountId.success) {
      return new Error("notification recipient account ID is invalid", {
        cause: recipientAccountId.error,
      })
    }

    const createdAt = new Date(props.createdAt)
    if (!Number.isSafeInteger(createdAt.getTime())) {
      return new Error("notification creation time is invalid")
    }

    // 通知と配送は一件ずつ対応するため、同じ UUID を両方の主キーに使う。
    const notificationId = crypto.randomUUID()
    const statements = prepareSystemNotificationPublicationBatch({
      database: this.c.env.DB,
      publications: [
        {
          message: {
            id: notificationId,
            kind: `company:${props.kind}`,
            title: props.title,
            body: props.body,
            source: {
              type: "company:notification.source",
              id: JSON.stringify({ domain: props.sourceDomain, id: props.sourceId }),
            },
            action: null,
            resourceScope: null,
            priority: "normal",
            publicationKey: null,
            createdAt,
          },
          deliveries: [
            {
              id: notificationId,
              recipientAccountId: recipientAccountId.data,
              deliveredAt: createdAt,
            },
          ],
        },
      ],
    })
    if (statements instanceof Error) return statements
    const batch = [...(options.guards ?? []), ...statements]

    try {
      const results = await this.c.env.DB.batch(batch)
      if (results.length !== batch.length || !results.every((result) => result.success)) {
        return new Error("notification publication did not succeed")
      }
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to publish notification")
    }

    return Object.freeze({
      id: notificationId,
      recipientAccountId: recipientAccountId.data,
      sourceDomain: props.sourceDomain,
      sourceId: props.sourceId,
      kind: props.kind,
      title: props.title,
      body: props.body,
      isRead: false as const,
      createdAt: props.createdAt,
    })
  }
}
