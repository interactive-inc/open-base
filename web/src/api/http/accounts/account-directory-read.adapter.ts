import {
  type CompanyAccountParticipant,
  resolveCompanyAccountParticipants,
} from "@/api/http/accounts/resolve-company-account-participants"
import type { Context } from "@/env"
import { openSystemAccountCatalog } from "@system/interface/operations/open-system-account-catalog"
import { openSystemIdentityCatalog } from "@system/interface/operations/open-system-identity-catalog"

const QUERY_CHUNK_SIZE = 50

export type AccountDirectoryStatus = "active" | "suspended" | "locked"

export type AccountDirectoryEntry = Readonly<{
  account_id: string
  name: string
  email: string | null
  status: AccountDirectoryStatus
}>

export type AccountDirectoryPage = Readonly<{
  accounts: ReadonlyArray<AccountDirectoryEntry>
  total: number
}>

type Props = Readonly<{
  status: AccountDirectoryStatus | null
  limit: number
  offset: number
}>

/** System Account と Company Employee を管理用 read model として合成する。 */
export class AccountDirectoryReadAdapter {
  constructor(private readonly context: Context) {
    Object.freeze(this)
  }

  async list(props: Props): Promise<AccountDirectoryPage | Error> {
    const systemAccounts = await openSystemAccountCatalog({
      env: { DB: this.context.env.DB },
    }).findMany()
    if (systemAccounts instanceof Error) return systemAccounts
    const selectedAccounts = systemAccounts.filter(
      (account) => props.status === null || account.status === props.status,
    )
    const participants: CompanyAccountParticipant[] = []
    for (let index = 0; index < selectedAccounts.length; index += QUERY_CHUNK_SIZE) {
      const chunk = await resolveCompanyAccountParticipants(
        this.context,
        selectedAccounts.slice(index, index + QUERY_CHUNK_SIZE).map((account) => account.id),
      )
      if (chunk instanceof Error) return chunk
      participants.push(...chunk)
    }
    const currentParticipants = participants.filter(
      (participant) => participant.status === "ACTIVE" || participant.status === "ON_LEAVE",
    )
    const emails = await openSystemIdentityCatalog({
      env: { DB: this.context.env.DB },
    }).primaryEmailsForAccounts(currentParticipants.map((participant) => participant.accountId))
    if (emails instanceof Error) return emails
    const accountsById = new Map(selectedAccounts.map((account) => [account.id, account]))
    const entries = currentParticipants
      .flatMap((participant) => {
        const account = accountsById.get(participant.accountId)
        return account === undefined
          ? []
          : [
              {
                account_id: account.id,
                name: participant.employeeName,
                email: emails.get(participant.accountId) ?? null,
                status: account.status,
              },
            ]
      })
      .toSorted((left, right) => {
        if (left.name !== right.name) return left.name < right.name ? -1 : 1
        return left.account_id < right.account_id
          ? -1
          : left.account_id === right.account_id
            ? 0
            : 1
      })

    return {
      accounts: entries.slice(props.offset, props.offset + props.limit),
      total: entries.length,
    }
  }
}
