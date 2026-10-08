"use server"

import { readCompanyRevision } from "@/lib/form/read-company-revision"
import { applyPersonnelAction } from "@/lib/api/apply-personnel-action"
import { createPersonnelActionRequest } from "@/lib/api/create-personnel-action-request"
import { getMe } from "@/lib/api/get-me"
import { requireAuth } from "@/lib/auth/require-auth"
import { toRequiredIsoDate } from "@/lib/form/to-required-iso-date"
import { revalidatePath } from "next/cache"

export type PersonnelActionFormState = { ok: boolean; error: string | null }

function text(form: FormData, name: string): string | null {
  const value = form.get(name)
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null
}

function buildAction(form: FormData): Record<string, unknown> | Error {
  const kind = text(form, "kind")
  const employeeCode = text(form, "employee_code")
  const eventOn = toRequiredIsoDate(form.get("event_on"), "発令日")
  if (!kind || !employeeCode) return new Error("発令の種類と対象者を指定してください")
  if (eventOn instanceof Error) return eventOn
  if (kind === "retired") return { kind, employeeCode, retirementOn: eventOn }
  const base = { kind, employeeCode, eventOn }
  if (kind === "rehire") {
    const employmentType = text(form, "employment_type")
    if (employmentType !== "FULL_TIME" && employmentType !== "PART_TIME")
      return new Error("雇用形態を選択してください")
    return {
      ...base,
      employmentType,
      departmentCode: text(form, "department_code"),
      positionCode: text(form, "position_code"),
      managerEmployeeCode: text(form, "manager_employee_code"),
    }
  }
  if (["leave_started", "returned"].includes(kind)) return base
  const departmentCode = text(form, "department_code")
  if (!departmentCode) return new Error("部署コードを入力してください")
  if (
    ["primary_assignment_started", "transferred", "concurrent_assignment_started"].includes(kind)
  ) {
    return {
      ...base,
      departmentCode,
      positionCode: text(form, "position_code"),
      managerEmployeeCode: text(form, "manager_employee_code"),
    }
  }
  if (["department_responsibility_started", "department_responsibility_ended"].includes(kind)) {
    return { ...base, departmentCode }
  }
  const assignmentType = text(form, "assignment_type")
  if (assignmentType !== "primary" && assignmentType !== "concurrent") {
    return new Error("所属区分を選択してください")
  }
  if (kind === "assignment_ended") return { ...base, departmentCode, assignmentType }
  if (kind === "manager_changed") {
    return {
      ...base,
      departmentCode,
      assignmentType,
      managerEmployeeCode: text(form, "manager_employee_code"),
    }
  }
  if (kind === "position_changed") {
    const positionCode = text(form, "position_code")
    const changeType = text(form, "change_type")
    if (!positionCode || !changeType) return new Error("役職と変更の種類を選択してください")
    return { ...base, departmentCode, assignmentType, positionCode, changeType }
  }
  return new Error("発令の種類が正しくありません")
}

export async function submitPersonnelAction(
  previous: PersonnelActionFormState,
  form: FormData,
): Promise<PersonnelActionFormState> {
  const me = await requireAuth()
  const mode = text(form, "mode")
  const requiredPermission =
    mode === "apply" ? "employee:lifecycle:apply" : "employee:lifecycle:request"
  if (!me.permissions.includes(requiredPermission)) {
    return { ok: false, error: "この人事発令を行う権限がありません" }
  }
  const companyRevision = readCompanyRevision(form)
  if (companyRevision instanceof Error) return { ok: false, error: companyRevision.message }
  const action = buildAction(form)
  if (action instanceof Error) return { ok: false, error: action.message }
  const employeeRevisionText = text(form, "employee_revision")
  const organizationRevisionText = text(form, "organization_revision")
  const employeeRevision = Number(employeeRevisionText)
  const organizationRevision = Number(organizationRevisionText)
  if (
    employeeRevisionText === null ||
    organizationRevisionText === null ||
    !Number.isInteger(employeeRevision) ||
    employeeRevision < 0 ||
    !Number.isInteger(organizationRevision) ||
    organizationRevision < 0
  ) {
    return { ok: false, error: "画面を再読み込みしてから、もう一度お試しください" }
  }
  const result =
    mode === "apply"
      ? await applyPersonnelAction(
          {
            action,
            expected_employee_revision: employeeRevision,
            expected_company_revision: companyRevision,
            expected_organization_revision: organizationRevision,
          },
          crypto.randomUUID(),
        )
      : await createPersonnelActionRequest({
          action,
          base_employee_revision: employeeRevision,
          base_company_revision: companyRevision,
          base_organization_revision: organizationRevision,
        })
  if (result instanceof Error) return { ok: false, error: result.message }
  const code = text(form, "employee_code")
  revalidatePath("/company/employees")
  if (code) revalidatePath(`/company/employees/${code}`)
  return { ok: true, error: null }
}

/** useActionState で参照する事実記録フォーム共通の戻り値。ok=成功 / error=表示するエラー文言。 */
