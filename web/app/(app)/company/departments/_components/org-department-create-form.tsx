"use client"

import { useRouter } from "next/navigation"
import { useActionState } from "react"
import { toast } from "sonner"
import { createOrgDepartmentAction } from "@/app/(app)/company/departments/actions"
import type { OrgDepartmentActionState } from "@/app/(app)/company/departments/actions"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

const initialState: OrgDepartmentActionState = { ok: false, error: null }

/** 組織単位のコード・名称・親を一度に登録する。 */
export function OrgDepartmentCreateForm() {
  const router = useRouter()

  async function reduce(
    previousState: OrgDepartmentActionState,
    formData: FormData,
  ): Promise<OrgDepartmentActionState> {
    const result = await createOrgDepartmentAction(previousState, formData)

    if (result.ok) {
      toast.success("部署を作成しました")

      router.push("/company/departments")
    } else if (result.error !== null) {
      toast.error(result.error)
    }

    return result
  }

  const [state, formAction, pending] = useActionState(reduce, initialState)

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="create_code">部署コード</FieldLabel>

          <Input id="create_code" name="code" placeholder="D010" />
        </Field>

        <Field>
          <FieldLabel htmlFor="create_name">部署名</FieldLabel>

          <Input id="create_name" name="name" placeholder="営業部" />
        </Field>

        <Field>
          <FieldLabel htmlFor="create_parent_code">親コード</FieldLabel>

          <Input id="create_parent_code" name="parent_code" placeholder="任意" />
        </Field>
      </FieldGroup>

      {state.error === null ? null : <FieldError>{state.error}</FieldError>}

      <Button type="submit" disabled={pending}>
        {pending ? "作成中…" : "部署を作成"}
      </Button>
    </form>
  )
}
