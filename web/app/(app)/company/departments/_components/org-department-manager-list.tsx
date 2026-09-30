"use client"

import { useActionState, useState } from "react"
import { toast } from "sonner"
import {
  deleteOrgDepartmentAction,
  updateOrgDepartmentAction,
} from "@/app/(app)/company/departments/actions"
import type { OrgDepartmentActionState } from "@/app/(app)/company/departments/actions"
import { ConfirmActionDialog } from "@/components/confirm-action-dialog"
import { TableRowActions } from "@/components/table-row-actions"
import { Button } from "@/components/ui/button"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { OrgDepartmentResponse } from "@/lib/api/types/org-types"

type Props = {
  departments: ReadonlyArray<OrgDepartmentResponse>
}

/**
 * 部署ノードの管理表。各行の変更（Dialog）・削除ボタンを置く。新規作成は /company/departments/new で行う。
 * 変更・削除はいずれも権限が必要で、権限不足時は api がエラーを返す。
 */
export function OrgDepartmentManagerList(props: Props) {
  return (
    <div className="flex flex-col gap-8">
      <div className="overflow-x-auto">
        <Table aria-label="一覧">
          <TableHeader>
            <TableRow>
              <TableHead>コード</TableHead>

              <TableHead>部署名</TableHead>

              <TableHead>親</TableHead>

              <TableHead>責任者</TableHead>

              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {props.departments.map((department) => (
              <TableRow
                key={`${department.id}:${department.organization_revision}:${department.as_of}`}
              >
                <TableCell>{department.code}</TableCell>

                <TableCell>{department.name}</TableCell>

                <TableCell>{department.parent_code ?? "-"}</TableCell>

                <TableCell>{department.manager_employee_code ?? "-"}</TableCell>

                <TableCell>
                  <TableRowActions>
                    <UpdateDepartmentDialog department={department} />

                    <DeleteDepartmentButton department={department} />
                  </TableRowActions>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

/** 組織単位変更フォームを Dialog で開く。名称と親を編集して送信する。 */
function UpdateDepartmentDialog(props: { department: OrgDepartmentResponse }) {
  const [open, setOpen] = useState(false)

  async function reduce(
    previousState: OrgDepartmentActionState,
    formData: FormData,
  ): Promise<OrgDepartmentActionState> {
    const result = await updateOrgDepartmentAction(previousState, formData)

    if (result.ok) {
      toast.success("部署を更新しました")

      setOpen(false)
    } else if (result.error !== null) {
      toast.error(result.error)
    }

    return result
  }

  const [state, formAction, pending] = useActionState(reduce, {
    ok: false,
    error: null,
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="secondary" size="sm" />}>変更</DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>部署を変更</DialogTitle>

          <DialogDescription>部署名と親部署を変更します。</DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="code" value={props.department.code} />
          <input
            type="hidden"
            name="expected_organization_revision"
            value={props.department.organization_revision}
          />
          <input type="hidden" name="expected_as_of" value={props.department.as_of} />

          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="update_name">部署名</FieldLabel>

              <Input id="update_name" name="name" defaultValue={props.department.name} />
            </Field>

            <Field>
              <FieldLabel htmlFor="update_parent_code">親コード</FieldLabel>

              <Input
                id="update_parent_code"
                name="parent_code"
                defaultValue={props.department.parent_code ?? ""}
                placeholder="任意"
              />
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

/** 部署ノード削除ボタン。成功・失敗の通知は action の結果を見て toast() で出す。 */
function DeleteDepartmentButton(props: { department: OrgDepartmentResponse }) {
  async function reduce(
    previousState: OrgDepartmentActionState,
    formData: FormData,
  ): Promise<OrgDepartmentActionState> {
    const result = await deleteOrgDepartmentAction(previousState, formData)

    if (result.ok) {
      toast.success("部署を削除しました")
    } else if (result.error !== null) {
      toast.error(result.error)
    }

    return result
  }

  const [state, formAction, pending] = useActionState(reduce, {
    ok: false,
    error: null,
  })

  return (
    <div className="flex flex-col items-end gap-2">
      <ConfirmActionDialog
        action={formAction}
        triggerLabel="削除"
        title={`部署 ${props.department.name}（${props.department.code}）を削除しますか？`}
        description="部署ノードの削除は元に戻せません。配下の部署がある場合は削除できません。"
        confirmLabel="部署を削除"
        pending={pending}
      >
        <input type="hidden" name="code" value={props.department.code} />
        <input
          type="hidden"
          name="expected_organization_revision"
          value={props.department.organization_revision}
        />
        <input type="hidden" name="expected_as_of" value={props.department.as_of} />
      </ConfirmActionDialog>

      {state.error === null ? null : <p className="text-xs text-destructive">{state.error}</p>}
    </div>
  )
}
