"use server"

import { revalidatePath } from "next/cache"
import { createApprovalDelegation } from "@/lib/api/create-approval-delegation"
import { deleteApprovalDelegation } from "@/lib/api/delete-approval-delegation"
import { toEntityId } from "@/lib/form/to-entity-id"
import { requireAuth } from "@/lib/auth/require-auth"

export type DelegationState = { ok: boolean; error: string | null }

export async function createDelegationAction(
  _previous: DelegationState,
  formData: FormData,
): Promise<DelegationState> {
  await requireAuth()

  const delegate = formData.get("delegate_employee_code")
  const template = formData.get("template_code")
  const starts = formData.get("starts_at")
  const ends = formData.get("ends_at")
  if (
    typeof delegate !== "string" ||
    delegate.trim() === "" ||
    typeof starts !== "string" ||
    typeof ends !== "string"
  )
    return { ok: false, error: "代理先と期間を入力してください" }
  const startsAt = new Date(starts)
  const endsAt = new Date(ends)
  if (Number.isNaN(startsAt.valueOf()) || Number.isNaN(endsAt.valueOf()))
    return { ok: false, error: "期間が不正です" }
  const result = await createApprovalDelegation({
    delegate_employee_code: delegate.trim(),
    template_code: typeof template === "string" && template.trim() !== "" ? template.trim() : null,
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
  })
  if (result instanceof Error) return { ok: false, error: result.message }
  revalidatePath("/teams/approval-delegations")
  return { ok: true, error: null }
}

export async function deleteDelegationAction(
  _previous: DelegationState,
  formData: FormData,
): Promise<DelegationState> {
  await requireAuth()

  const id = toEntityId(formData.get("delegation_id"))
  if (id === null) return { ok: false, error: "代理設定を特定できません" }
  const result = await deleteApprovalDelegation(id)
  if (result instanceof Error) return { ok: false, error: result.message }
  revalidatePath("/teams/approval-delegations")
  return { ok: true, error: null }
}
