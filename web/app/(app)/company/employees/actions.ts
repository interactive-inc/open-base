"use server"

import { readCompanyRevision } from "@/lib/form/read-company-revision"
import { readEmployeeProfileCommand } from "@/lib/form/read-employee-profile-command"
import { revalidatePath } from "next/cache"
import { createEmployee } from "@/lib/api/create-employee"
import { updateEmployee } from "@/lib/api/update-employee"
import type { EmployeeRole } from "@/lib/api/types/employee-types"
import { canCreateEmployee } from "@/lib/employee/can-create-employee"
import { canUpdateEmployee } from "@/lib/employee/can-update-employee"
import { requireAuth } from "@/lib/auth/require-auth"
import { FORM_CONSTRAINTS } from "@/lib/form/constraints"
import { isValidEmail } from "@/lib/form/is-valid-email"
import { toOptionalText } from "@/lib/form/to-optional-text"
import { toRequiredIsoDate } from "@/lib/form/to-required-iso-date"
import { toRequiredText } from "@/lib/form/to-required-text"

export type EmployeeCreateFormState = {
  ok: boolean
  error: string | null
}

export type EmployeeUpdateFormState = {
  ok: boolean
  error: string | null
}

const employeeRoles: ReadonlyArray<EmployeeRole> = ["member", "manager", "hr", "root"]

/** FormData の文字列をロール enum へ検証付きで変換する。不正なら null。 */
function toRole(value: FormDataEntryValue | null): EmployeeRole | null {
  if (typeof value !== "string") {
    return null
  }

  for (const role of employeeRoles) {
    if (role === value) {
      return role
    }
  }

  return null
}

/**
 * 人物台帳、入社発令、初期アカウントを一括作成する Server Action。
 * バリデーションエラーは集約して一度に返す。
 */
export async function createEmployeeAction(
  previousState: EmployeeCreateFormState,
  formData: FormData,
): Promise<EmployeeCreateFormState> {
  const currentUser = await requireAuth()

  if (canCreateEmployee(currentUser.permissions) === false) {
    return { ok: false, error: "従業員を登録する権限がありません" }
  }

  const errors: Array<string> = []

  const code = toRequiredText(formData.get("code"), {
    label: "コード",
    max: FORM_CONSTRAINTS.employee.codeMax,
  })

  if (code instanceof Error) {
    errors.push(code.message)
  }

  const name = toRequiredText(formData.get("name"), {
    label: "氏名",
    max: FORM_CONSTRAINTS.employee.nameMax,
  })

  if (name instanceof Error) {
    errors.push(name.message)
  }

  const email = toRequiredText(formData.get("email"), {
    label: "メール",
    max: FORM_CONSTRAINTS.employee.emailMax,
  })

  if (email instanceof Error) {
    errors.push(email.message)
  } else if (isValidEmail(email) === false) {
    errors.push("メールはメールアドレス形式で入力してください")
  }

  const password = toRequiredText(formData.get("password"), {
    label: "初期パスワード",
    min: FORM_CONSTRAINTS.employee.passwordMin,
    max: FORM_CONSTRAINTS.employee.passwordMax,
  })

  if (password instanceof Error) {
    errors.push(password.message)
  }

  const role = toRole(formData.get("role"))

  const hireOn = toRequiredIsoDate(formData.get("hire_on"), "入社日")
  const employmentType = formData.get("employment_type")
  if (employmentType !== "FULL_TIME" && employmentType !== "PART_TIME") {
    return { ok: false, error: "雇用区分を選択してください" }
  }

  if (role === null) {
    errors.push("ロールを入力してください")
  }

  if (hireOn instanceof Error) errors.push(hireOn.message)

  const departmentCode = toOptionalText(formData.get("department_code"), {
    label: "部署コード",
    max: FORM_CONSTRAINTS.employee.codeMax,
  })

  if (departmentCode instanceof Error) {
    errors.push(departmentCode.message)
  }

  const positionCode = toOptionalText(formData.get("position_code"), {
    label: "役職コード",
    max: FORM_CONSTRAINTS.employee.codeMax,
  })

  if (positionCode instanceof Error) {
    errors.push(positionCode.message)
  }

  const managerEmployeeCode = toOptionalText(formData.get("manager_employee_code"), {
    label: "直属上司コード",
    max: FORM_CONSTRAINTS.employee.codeMax,
  })
  if (managerEmployeeCode instanceof Error) errors.push(managerEmployeeCode.message)

  // 役職は配属先部署の発令に載るため、部署なしで役職だけ指定すると役職が保存されない。
  if (
    !(departmentCode instanceof Error) &&
    !(positionCode instanceof Error) &&
    departmentCode === null &&
    positionCode !== null
  ) {
    errors.push("役職は配属先部署とあわせて指定してください")
  }

  if (errors.length > 0) {
    return { ok: false, error: errors.join("、") }
  }

  // errors.length === 0 なら全フィールドは非 Error 確定
  const companyRevision = readCompanyRevision(formData)
  if (companyRevision instanceof Error) return { ok: false, error: companyRevision.message }

  const created = await createEmployee({
    expected_company_revision: companyRevision,
    code: code as string,
    name: name as string,
    email: email as string,
    password: password as string,
    role: role as EmployeeRole,
    hire_on: hireOn as string,
    employment_type: employmentType,
    department_code: departmentCode as string | null,
    position_code: positionCode as string | null,
    manager_employee_code: managerEmployeeCode as string | null,
  })

  if (created instanceof Error) {
    return { ok: false, error: created.message }
  }

  revalidatePath("/company/employees")

  return { ok: true, error: null }
}

/** 人物台帳の氏名更新。IAM と人事ライフサイクルの項目は専用操作でのみ変更する。 */
export async function updateEmployeeAction(
  previousState: EmployeeUpdateFormState,
  formData: FormData,
): Promise<EmployeeUpdateFormState> {
  const currentUser = await requireAuth()

  if (canUpdateEmployee(currentUser.permissions) === false) {
    return { ok: false, error: "従業員を更新する権限がありません" }
  }

  const code = toRequiredText(formData.get("code"), {
    label: "従業員コード",
    max: FORM_CONSTRAINTS.employee.codeMax,
  })

  if (code instanceof Error) {
    return { ok: false, error: code.message }
  }

  const name = toRequiredText(formData.get("name"), {
    label: "氏名",
    max: FORM_CONSTRAINTS.employee.nameMax,
  })

  if (name instanceof Error) {
    return { ok: false, error: name.message }
  }

  const command = readEmployeeProfileCommand(formData)
  if (command instanceof Error) return { ok: false, error: command.message }
  const updated = await updateEmployee(
    code,
    { name, profile: command.profile, reason: command.reason },
    command.commandId,
  )

  if (updated instanceof Error) {
    return { ok: false, error: updated.message }
  }

  revalidatePath("/company/employees")

  revalidatePath(`/company/employees/${code}`)

  return { ok: true, error: null }
}
