import { InvalidEmployeeError } from "@/contexts/company/domain/errors"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"

export type EmployeeProps = Readonly<{
  id: EmployeeId
  officialName: string
  employeeCode: string | null
  email: string | null
  phone: string | null
}>

function isCanonicalText(value: string | null, maximumLength: number): boolean {
  if (value === null) return true
  if (value.length < 1 || value.length > maximumLength || value.trim() !== value) return false

  for (const character of value) {
    const codePoint = character.codePointAt(0)
    if (codePoint !== undefined && (codePoint <= 0x1f || codePoint === 0x7f)) return false
  }
  return true
}

/** Companyで働く人の安定した識別子と正規プロフィールを所有するEntity。 */
export class EmployeeEntity {
  readonly id: EmployeeId
  readonly officialName: string
  readonly employeeCode: string | null
  readonly email: string | null
  readonly phone: string | null

  private constructor(props: EmployeeProps) {
    this.id = props.id
    this.officialName = props.officialName
    this.employeeCode = props.employeeCode
    this.email = props.email
    this.phone = props.phone
    Object.freeze(this)
  }

  static restore(props: EmployeeProps): EmployeeEntity | InvalidEmployeeError {
    if (
      !isCanonicalText(props.officialName, 200) ||
      !isCanonicalText(props.employeeCode, 64) ||
      !isCanonicalText(props.email, 320) ||
      !isCanonicalText(props.phone, 64)
    ) {
      return new InvalidEmployeeError()
    }

    return new EmployeeEntity(props)
  }

  withOfficialName(officialName: string): EmployeeEntity | InvalidEmployeeError {
    return EmployeeEntity.restore({ ...this.toProps(), officialName })
  }

  withPhone(phone: string | null): EmployeeEntity | InvalidEmployeeError {
    return EmployeeEntity.restore({ ...this.toProps(), phone })
  }

  toProps(): EmployeeProps {
    return {
      id: this.id,
      officialName: this.officialName,
      employeeCode: this.employeeCode,
      email: this.email,
      phone: this.phone,
    }
  }
}
