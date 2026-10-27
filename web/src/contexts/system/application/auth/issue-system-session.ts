import type {
  IssueSystemSessionCommand,
  IssueSystemSessionResult,
} from "@system/domain/definitions/auth/system-session-issuance.definition"
import {
  SystemSessionIssuanceAdapter,
  type SystemSessionIssuanceAdapterContext,
} from "@system/infrastructure/adapters/auth/system-session-issuance.adapter"

type Context = SystemSessionIssuanceAdapterContext

/** システムセッションを発行する。 */
export class IssueSystemSession {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(command: IssueSystemSessionCommand): Promise<IssueSystemSessionResult | Error> {
    return await new SystemSessionIssuanceAdapter(this.c).issue(command)
  }
}
