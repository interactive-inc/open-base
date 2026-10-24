import { z } from "zod"
import { organizationProfileVersionSchema } from "@/contexts/company/domain/definitions/organization-profile-version.definition"

const schema = z
  .object({
    name: z.string().trim().min(1).max(2000),
    representativeName: z.string().trim().min(1).max(2000).nullable(),
    locale: z.string().nullable(),
    timeZone: z.string().nullable(),
    fiscalYearStartMonth: z.number().int().min(1).max(12).nullable(),
    version: organizationProfileVersionSchema,
    sourceJson: z.string(),
  })
  .readonly()
type Props = z.infer<typeof schema>

/** 表示した会社情報と、その時点・版・移行前の情報を固定する。 */
export class OrganizationProfileValue {
  private constructor(readonly props: Props) {
    Object.freeze(this)
  }
  get name() {
    return this.props.name
  }
  get representativeName() {
    return this.props.representativeName
  }
  static create(value: unknown): OrganizationProfileValue | Error {
    const parsed = schema.safeParse(value)
    return parsed.success ? new OrganizationProfileValue(parsed.data) : parsed.error
  }
}
