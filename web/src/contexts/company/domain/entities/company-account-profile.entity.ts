import { z } from "zod"

export type CompanyAccountProfileProps = Readonly<{
  organizationId: string
  accountId: string
  displayName: string
  createdAt: Date
  updatedAt: Date
}>

/** System Accountへ意味を足さず、Company内の表示名だけを所有する。 */
export class CompanyAccountProfileEntity {
  readonly organizationId: string
  readonly accountId: string
  readonly displayName: string
  readonly createdAt: Date
  readonly updatedAt: Date

  private constructor(props: CompanyAccountProfileProps) {
    this.organizationId = props.organizationId
    this.accountId = props.accountId
    this.displayName = props.displayName
    this.createdAt = new Date(props.createdAt.getTime())
    this.updatedAt = new Date(props.updatedAt.getTime())
    Object.freeze(this)
  }

  static create(props: CompanyAccountProfileProps): CompanyAccountProfileEntity | Error {
    const parsed = z
      .strictObject({
        organizationId: z.string().regex(/^\S{1,255}$/),
        accountId: z.string().regex(/^\S{1,255}$/),
        displayName: z.string().min(1).max(200),
        createdAt: z.date(),
        updatedAt: z.date(),
      })
      .safeParse(props)

    if (!parsed.success) return parsed.error
    if (
      parsed.data.displayName.trim() !== parsed.data.displayName ||
      parsed.data.displayName.includes("\0") ||
      !Number.isSafeInteger(parsed.data.createdAt.getTime()) ||
      parsed.data.createdAt.getTime() < 0 ||
      !Number.isSafeInteger(parsed.data.updatedAt.getTime()) ||
      parsed.data.updatedAt.getTime() < parsed.data.createdAt.getTime()
    ) {
      return new Error("invalid Company Account Profile")
    }

    return new CompanyAccountProfileEntity(parsed.data)
  }

  /** Account情報からCompany内表示名を氏名・メール・IDの順に確定する。 */
  static displayNameFromAccount(name: string, email: string | null, accountId: string): string {
    for (const candidate of [name, email ?? "", accountId]) {
      const displayName = candidate.trim().slice(0, 200).trim()
      if (displayName !== "") return displayName
    }

    return accountId.slice(0, 200)
  }

  rename(displayName: string, updatedAt: Date): CompanyAccountProfileEntity | Error {
    return CompanyAccountProfileEntity.create({
      organizationId: this.organizationId,
      accountId: this.accountId,
      displayName,
      createdAt: this.createdAt,
      updatedAt,
    })
  }
}
