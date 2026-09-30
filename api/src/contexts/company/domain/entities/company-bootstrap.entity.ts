import { z } from "zod"
import { CompanyValidationError } from "@/contexts/company/domain/errors"

const schema = z
  .object({
    commandId: z.string().regex(/^\S{1,200}$/),
    accountId: z.string().regex(/^\S{1,255}$/),
    employeeCode: z.string().trim().min(1).max(64),
    employeeName: z.string().trim().min(1).max(200),
    organizationName: z.string().trim().min(1).max(200),
    representativeName: z.string().trim().min(1).max(200),
    initialResponsibilities: z
      .array(z.enum(["MANAGER", "PEOPLE_OPERATIONS"]))
      .max(2)
      .refine((values) => new Set(values).size === values.length)
      .readonly(),
    effectiveOn: z.string().date(),
    employmentType: z.enum(["FULL_TIME", "PART_TIME"]),
    locale: z.string().regex(/^[a-z]{2,3}(?:-[A-Z]{2})?$/),
    timeZone: z
      .string()
      .regex(/^(?:UTC|[A-Za-z_]+(?:\/[A-Za-z0-9_+-]+)+)$/)
      .max(100),
    fiscalYearStartMonth: z.number().int().min(1).max(12),
    reason: z.string().trim().min(1).max(1000),
    observedOn: z.string().date(),
    recordedAt: z.number().int().nonnegative(),
  })
  .readonly()
type Props = z.infer<typeof schema>
export type CompanyBootstrapInput = Omit<Props, "accountId" | "observedOn" | "recordedAt">

/** 確認した会社文脈と最初の従業員の在籍事実を、初期化の宣言として固定する。 */
export class CompanyBootstrapEntity {
  private constructor(readonly props: Props) {
    Object.freeze(this)
  }
  static create(props: Props): CompanyBootstrapEntity | CompanyValidationError {
    const parsed = schema.safeParse(props)
    if (!parsed.success)
      return new CompanyValidationError(
        "初期登録の内容が不正です",
        "invalid_company_bootstrap_input",
        { cause: parsed.error },
      )
    if (
      parsed.data.effectiveOn > parsed.data.observedOn ||
      [
        parsed.data.employeeName,
        parsed.data.employeeCode,
        parsed.data.organizationName,
        parsed.data.representativeName,
        parsed.data.reason,
      ].some((value) => value.includes("\0"))
    )
      return new CompanyValidationError(
        "現在在籍している最初の従業員の事実を指定してください",
        "invalid_company_bootstrap_input",
      )
    try {
      new Intl.DateTimeFormat(parsed.data.locale, { timeZone: parsed.data.timeZone }).format(
        parsed.data.recordedAt,
      )
    } catch (cause) {
      return new CompanyValidationError(
        "会社の言語またはtimezoneが不正です",
        "invalid_company_bootstrap_input",
        { cause },
      )
    }
    return new CompanyBootstrapEntity(parsed.data)
  }
}
