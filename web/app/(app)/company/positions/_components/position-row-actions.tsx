"use client"

import { PositionRevisionFields } from "@/app/(app)/company/positions/_components/position-revision-fields"
import { useActionState } from "react"
import { toast } from "sonner"
import { cancelPositionAction } from "@/app/(app)/company/positions/actions"
import { PositionEditForm } from "@/app/(app)/company/positions/_components/position-edit-form"
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
import type { PositionResponse } from "@/lib/api/types/position-types"

type Props = {
  position: PositionResponse
}

/** 役職一覧の各行の操作。変更（Dialog フォーム）と取消ボタンを並べる。 */
export function PositionRowActions(props: Props) {
  return (
    <div className="flex justify-end gap-2">
      <PositionEditForm position={props.position} />

      <CancelPositionButton position={props.position} />
    </div>
  )
}

/** 役職取消ボタン。確認ダイアログを表示し、承認後に Server Action を呼ぶ。 */
function CancelPositionButton(props: Props) {
  async function reduce(previousState: { ok: boolean; error: string | null }, formData: FormData) {
    const result = await cancelPositionAction(previousState, formData)

    if (result.error !== null) {
      toast.error(result.error)
    } else if (result.ok) {
      toast.success("役職の取消を記録しました")
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
          <AlertDialogTitle>この役職を取り消しますか？</AlertDialogTitle>

          <AlertDialogDescription>
            指定した日からの取消を記録します。過去の改訂と判断理由は残ります。
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel>やめる</AlertDialogCancel>

          <form action={formAction}>
            <PositionRevisionFields
              jobId={props.position.jobId}
              id={props.position.id}
              companyRevision={props.position.organizationRevision}
              resourceRevision={props.position.revision}
              commandId={props.position.cancelCommandId}
              effectiveFrom=""
              effectiveTo={null}
              isCancellation
            />
            <input type="hidden" name="code" value={props.position.code} />
            <input type="hidden" name="name" value={props.position.name} />
            <input type="hidden" name="rank" value={props.position.rank ?? ""} />
            <input type="hidden" name="description" value={props.position.description ?? ""} />

            <AlertDialogAction type="submit" variant="destructive" disabled={isPending}>
              取消を記録
            </AlertDialogAction>
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
