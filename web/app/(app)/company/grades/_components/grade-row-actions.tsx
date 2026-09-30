"use client"

import { GradeRevisionFields } from "@/app/(app)/company/grades/_components/grade-revision-fields"
import { useActionState } from "react"
import { toast } from "sonner"
import { cancelGradeAction } from "@/app/(app)/company/grades/actions"
import { GradeEditForm } from "@/app/(app)/company/grades/_components/grade-edit-form"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import type { GradeResponse } from "@/lib/api/types/grade-types"

type Props = {
  grade: GradeResponse
}

/** 等級一覧の各行の操作。変更（Dialog フォーム）と取消ボタンを並べる。 */
export function GradeRowActions(props: Props) {
  return (
    <div className="flex justify-end gap-2">
      <GradeEditForm grade={props.grade} />

      <CancelGradeButton grade={props.grade} />
    </div>
  )
}

/** 等級取消ボタン。確認ダイアログを表示し、承認後に Server Action を呼ぶ。 */
function CancelGradeButton(props: Props) {
  async function reduce(previousState: { ok: boolean; error: string | null }, formData: FormData) {
    const result = await cancelGradeAction(previousState, formData)

    if (result.error !== null) {
      toast.error(result.error)
    } else if (result.ok) {
      toast.success("等級の取消を記録しました")
    }

    return result
  }

  const action = useActionState(reduce, { ok: false, error: null })

  const formAction = action[1]

  const isPending = action[2]

  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button variant="destructive" size="sm" disabled={isPending} />}>
        取消
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>この等級を取り消しますか？</AlertDialogTitle>

          <AlertDialogDescription>
            指定した日からの取消を記録します。過去の改訂と判断理由は残ります。
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel>やめる</AlertDialogCancel>

          <form action={formAction}>
            <GradeRevisionFields
              id={props.grade.id}
              companyRevision={props.grade.organizationRevision}
              resourceRevision={props.grade.revision}
              commandId={props.grade.cancelCommandId}
              effectiveFrom=""
              effectiveTo={null}
              isCancellation
            />
            <input type="hidden" name="code" value={props.grade.code} />
            <input type="hidden" name="name" value={props.grade.name} />
            <input type="hidden" name="rank" value={props.grade.rank ?? ""} />
            <input type="hidden" name="description" value={props.grade.description ?? ""} />

            <AlertDialogAction type="submit" variant="destructive" disabled={isPending}>
              取消を記録
            </AlertDialogAction>
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
