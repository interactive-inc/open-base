import { openCompanyEmployeeDirectory } from "@/contexts/company/interface/operations/open-company-employee-directory"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import type { CompanySessionValue } from "@/contexts/company/domain/values/company-session.value"
import type { CompanyNotificationKind } from "@/api/http/notifications/notification-kind.definition"
import type { PublishedEmployeeNotification } from "@/api/http/notifications/employee-notification.adapter"
import type { Context } from "@/env"
import { EmployeeNotificationAdapter } from "@/api/http/notifications/employee-notification.adapter"
import { ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"

export type Command = {
  session: CompanySessionValue
  recipientEmployeeCode: string
  kind: CompanyNotificationKind
  title: string
  body: string | null
  sourceDomain: string
  sourceId: number | null
  createdAt: string
}

export type SentNotification = Readonly<{
  notification: PublishedEmployeeNotification
  recipientEmployeeId: EmployeeId
}>

/**
 * 権限を持つ役割が、相手の社員コードを解決して通知を作成する。
 */
export class PublishEmployeeNotification {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<SentNotification | ApplicationError> {
    const employeeRepository = openCompanyEmployeeDirectory(this.c)

    if (command.session.hasPermission("notification:send") === false) {
      return new ForbiddenError("cannot send notification", "notification_forbidden")
    }

    const recipient = await employeeRepository.findByCode(command.recipientEmployeeCode)

    if (recipient instanceof Error) {
      return new UnexpectedError("failed to find recipient", { cause: recipient })
    }

    if (recipient === null) {
      return new NotFoundError("recipient not found", "recipient_not_found")
    }

    const created = await new EmployeeNotificationAdapter(this.c).create({
      recipientEmployeeId: recipient.id,
      kind: command.kind,
      title: command.title,
      body: command.body,
      sourceDomain: command.sourceDomain,
      sourceId: command.sourceId,
      createdAt: command.createdAt,
    })

    if (created instanceof Error) {
      return new UnexpectedError("failed to create notification", { cause: created })
    }

    return { notification: created, recipientEmployeeId: recipient.id }
  }
}
