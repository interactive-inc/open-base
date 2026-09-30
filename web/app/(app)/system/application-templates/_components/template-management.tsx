"use client"

import { useState } from "react"
import {
  deleteApplicationTemplateAction,
  updateApplicationTemplateAction,
} from "@/app/(app)/system/application-templates/actions"
import { useFormAction } from "@/hooks/use-form-action"
import { FormBuilder } from "@/components/form-builder"
import { Button } from "@/components/ui/button"
import { ConfirmActionDialog } from "@/components/confirm-action-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { toFormSchema } from "@/lib/application/form-schema"
import Link from "next/link"

type ManagedTemplate = {
  code: string
  name: string
  category: string
  description: string | null
  schema_json?: unknown
  approver_roles: ReadonlyArray<string>
}

type Props = {
  template: ManagedTemplate
}

/**
 * テンプレートの管理操作（変更 Dialog と削除）。管理権限にのみ表示する。
 */
export function TemplateManagement(props: Props) {
  return (
    <div className="flex items-center gap-2">
      <Button
        variant="secondary"
        size="sm"
        nativeButton={false}
        render={<Link href={`/system/application-templates/${props.template.code}/workflow`} />}
      >
        承認フロー
      </Button>
      <UpdateTemplateDialog template={props.template} />

      <DeleteTemplateButton code={props.template.code} />
    </div>
  )
}

function UpdateTemplateDialog(props: { template: ManagedTemplate }) {
  const [open, setOpen] = useState(false)

  const [state, formAction, pending] = useFormAction(
    updateApplicationTemplateAction,
    {
      ok: false,
      error: null,
    },
    "テンプレートを変更しました",
  )

  const initialSchema = toFormSchema(props.template.schema_json)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="secondary" size="sm" />}>変更</DialogTrigger>

      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>テンプレートを変更</DialogTitle>

          <DialogDescription>コードは変更されません。</DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="code" value={props.template.code} />

          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="update_name">名称</FieldLabel>

              <Input id="update_name" name="name" defaultValue={props.template.name} />
            </Field>

            <Field>
              <FieldLabel htmlFor="update_category">カテゴリ</FieldLabel>

              <Input id="update_category" name="category" defaultValue={props.template.category} />
            </Field>

            <Field>
              <FieldLabel htmlFor="update_description">説明</FieldLabel>

              <Input
                id="update_description"
                name="description"
                defaultValue={props.template.description ?? ""}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="update_approver_roles">承認ロール（カンマ区切り）</FieldLabel>

              <Input
                id="update_approver_roles"
                name="approver_roles"
                defaultValue={props.template.approver_roles.join(", ")}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="update_form_builder">入力項目</FieldLabel>

              <FormBuilder name="schema_json" initialSchema={initialSchema} />
            </Field>
          </FieldGroup>

          {state.error === null ? null : <FieldError>{state.error}</FieldError>}

          <Button type="submit" disabled={pending}>
            変更を保存
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function DeleteTemplateButton(props: { code: string }) {
  const [state, formAction, pending] = useFormAction(
    deleteApplicationTemplateAction,
    {
      ok: false,
      error: null,
    },
    "テンプレートを削除しました",
  )

  return (
    <div className="flex flex-col gap-2">
      <ConfirmActionDialog
        action={formAction}
        triggerLabel="削除"
        title="この申請テンプレートを削除しますか？"
        description="テンプレートは元に戻せません。既存の申請記録は削除されません。"
        confirmLabel="テンプレートを削除"
        pending={pending}
      >
        <input type="hidden" name="code" value={props.code} />
      </ConfirmActionDialog>

      {state.error === null ? null : <FieldError>{state.error}</FieldError>}
    </div>
  )
}
