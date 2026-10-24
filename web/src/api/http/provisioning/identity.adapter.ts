import { readCompanyAccountDisplayNames } from "@/contexts/company/interface/operations/read-company-account-display-names"
import { readCompanyAccountEmployeeLinks } from "@/contexts/company/interface/operations/read-company-account-employee-links"
import { openCompanyEmployeeDirectory } from "@/contexts/company/interface/operations/open-company-employee-directory"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import type { Context } from "@/env"
import type { IdentityProvider } from "@system/domain/schemas/identity/identity-provider.schema"
import { identitySubjectSchema } from "@system/domain/schemas/identity/identity-subject.schema"
import { zAccountId, type AccountId } from "@system/domain/schemas/iam/account-id.schema"
import type { IdentityId } from "@system/domain/schemas/identity/identity-id.schema"
import { readSystemAccountSnapshot } from "@system/interface/operations/read-system-account-snapshot"
import { findSystemIdentityLogin } from "@system/interface/operations/find-system-identity-login"
import { findSystemIdentityByEmail } from "@system/interface/operations/find-system-identity-by-email"
import { openSystemIdentityCatalog } from "@system/interface/operations/open-system-identity-catalog"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

export type ProviderIdentity = {
  identityId: IdentityId
  accountId: AccountId
  accountStatus: string
  tokenVersion: number
  employeeId: EmployeeId | null
  email: string | null
  employeeName: string | null
  profileDisplayName: string | null
}

export type AccountAuthState = {
  accountId: AccountId
  accountStatus: string
  tokenVersion: number
  employeeId: EmployeeId | null
}

/** System Identity と Company Employee/Profile の明示的な読み取り合成。 */
export class IdentityAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async findByProviderSubject(
    provider: IdentityProvider,
    subjectInput: string,
  ): Promise<ProviderIdentity | null | Error> {
    const subject = identitySubjectSchema.safeParse(subjectInput)
    if (!subject.success) return null
    const login = await findSystemIdentityLogin(
      { env: { DB: this.c.env.DB } },
      provider,
      subject.data,
    )
    if (login === null || login instanceof Error) return login
    const identity = await openSystemIdentityCatalog({
      env: { DB: this.c.env.DB },
    }).find(login.identity.id)
    if (identity === null || identity instanceof Error) return identity

    try {
      const now = this.c.env.NOW ?? new Date().toISOString()
      const employees = await openCompanyEmployeeDirectory({
        env: { ...this.c.env, NOW: now },
      }).findForAccountIds([login.account.id])
      if (employees instanceof Error) return employees
      const employee = employees[0]?.employee
      const displayNames = await readCompanyAccountDisplayNames({
        database: this.c.env.DB,
        organizationIds: [COMPANY_DEFAULT_ORGANIZATION_ID],
        accountIds: [login.account.id],
        now,
        timeZone: this.c.env.COMPANY_TIME_ZONE,
      })

      return {
        identityId: login.identity.id,
        accountId: login.account.id,
        accountStatus: login.account.status,
        tokenVersion: login.account.tokenVersion,
        employeeId: employee?.id ?? null,
        email: identity.email,
        employeeName: employee?.officialName ?? null,
        profileDisplayName: displayNames.get(login.account.id) ?? null,
      }
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to compose Company Identity")
    }
  }

  async findAccountIdByEmail(email: string): Promise<AccountId | null | Error> {
    const identity = await findSystemIdentityByEmail(
      {
        env: { DB: this.c.env.DB },
      },
      email,
    )
    return identity instanceof Error ? identity : (identity?.accountId ?? null)
  }

  async findAccountById(accountId: AccountId): Promise<AccountAuthState | null | Error> {
    const account = await readSystemAccountSnapshot(this.c.env.DB, accountId)
    if (account === null || account instanceof Error) return account

    try {
      const links = await readCompanyAccountEmployeeLinks(this.c, {
        accountIds: [accountId],
      })
      if (links instanceof Error) return links
      const employeeId = links[0]?.employeeId ?? null

      return {
        accountId,
        accountStatus: account.status,
        tokenVersion: account.tokenVersion,
        employeeId,
      }
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to compose Company Account")
    }
  }

  async findEmployeeIdByEmail(email: string): Promise<EmployeeId | null | Error> {
    const identity = await findSystemIdentityByEmail(
      {
        env: { DB: this.c.env.DB },
      },
      email,
    )
    if (identity === null || identity instanceof Error) return identity

    try {
      const links = await readCompanyAccountEmployeeLinks(this.c, {
        accountIds: [identity.accountId],
      })
      if (links instanceof Error) return links
      return links[0]?.employeeId ?? null
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to find Company Employee link")
    }
  }

  async findEmailsByEmployeeIds(
    employeeIds: ReadonlyArray<EmployeeId>,
  ): Promise<Map<EmployeeId, string> | Error> {
    if (employeeIds.length === 0) return new Map()

    try {
      const links = await readCompanyAccountEmployeeLinks(this.c, {
        employeeIds,
      })
      if (links instanceof Error) return links
      const identities = await Promise.all(
        links.map((link) =>
          openSystemIdentityCatalog({ env: { DB: this.c.env.DB } }).findMany(
            zAccountId.parse(link.accountId),
          ),
        ),
      )
      const unavailable = identities.find((entries) => entries instanceof Error)
      if (unavailable instanceof Error) return unavailable

      const emails = new Map<EmployeeId, string>()
      for (const [index, link] of links.entries()) {
        const entries = identities[index]
        if (entries instanceof Error || entries === undefined) continue
        const preferred = entries
          .filter((entry) => entry.binding.state === "active" && entry.email !== null)
          .toSorted((left, right) =>
            left.binding.provider === right.binding.provider
              ? left.binding.createdAt.getTime() - right.binding.createdAt.getTime()
              : left.binding.provider === "password"
                ? -1
                : 1,
          )
          .at(0)
        if (preferred?.email !== null && preferred?.email !== undefined) {
          emails.set(link.employeeId, preferred.email)
        }
      }

      return emails
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to resolve Company emails")
    }
  }
}
