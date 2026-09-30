"use client"

import type { EntityId } from "@/lib/api/types/entity-id"
import { formatDateTime } from "@/lib/format-date-time"
import Link from "next/link"
import { useRef, useState } from "react"
import {
  updateApplicationAction,
  resubmitApplicationAction,
  withdrawApplicationAction,
} from "@/app/(app)/my/applications/actions"
import { useFormAction } from "@/hooks/use-form-action"
import { ApplicationStatusBadge } from "@/components/application-status-badge"
import { EmptyState } from "@/components/empty-state"
import { TableRowActions } from "@/components/table-row-actions"
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
import { Textarea } from "@/components/ui/textarea"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { ApplicationListItem } from "@/lib/api/types/application-types"

type Props = {
  applications: ReadonlyArray<ApplicationListItem>
}

/** 自分の申請一覧。承認待ちの申請には変更（Dialog フォーム）と取り下げボタンを置く表示コンポーネント。 */
export function MyApplicationsList(props: Props) {
  if (props.applications.length === 0) {
    return (
      <EmptyState
        title="提出済みの申請はまだありません"
        description="右上の「新規申請」から申請を提出できます。"
      />
    )
  }

  return (
    <div className="overflow-x-auto">
      <Table aria-label="一覧">
        <TableHeader>
          <TableRow>
            <TableHead>申請 ID</TableHead>
            <TableHead>ステータス</TableHead>
            <TableHead>現在のステップ</TableHead>
            <TableHead>申請日</TableHead>
            <TableHead className="text-right">操作</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {props.applications.map((application) => (
            <TableRow key={application.id}>
              <TableCell>
                <Link
                  href={`/system/applications/${application.id}`}
                  className="font-medium underline-offset-4 hover:underline"
                >
                  {application.id}
                </Link>
              </TableCell>

              <TableCell>
                <ApplicationStatusBadge
                  status={application.status}
                  returned={application.current_step?.startsWith("returned:") === true}
                />
              </TableCell>

              <TableCell>{application.current_step ?? "-"}</TableCell>

              <TableCell>{formatDateTime(application.created_at)}</TableCell>

              <TableCell>
                <ApplicationRowActions application={application} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

/** 承認待ちのときだけ変更・取り下げ操作を表示する。審査済みや未採番は操作不可。 */
function ApplicationRowActions(props: { application: ApplicationListItem }) {
  const applicationId = props.application.id

  if (props.application.status !== "pending" || applicationId === null) {
    return <span className="block text-right text-xs text-muted-foreground">操作不可</span>
  }

  return (
    <TableRowActions>
      {props.application.current_step?.startsWith("returned:") ? (
        <UpdateApplicationDialog
          application={props.application}
          applicationId={applicationId}
          resubmit
        />
      ) : null}

      <WithdrawApplicationButton applicationId={applicationId} />
    </TableRowActions>
  )
}

/**
 * 申請内容の更新フォームを Dialog で開く。payload を JSON テキストで編集して送信する。
 * 編集途中で閉じようとした場合は confirm() で破棄確認を行う。
 */
function UpdateApplicationDialog(props: {
  application: ApplicationListItem
  applicationId: EntityId
  resubmit?: boolean
}) {
  const [open, setOpen] = useState(false)

  const isDirty = useRef(false)

  const initialPayload = JSON.stringify(props.application.payload, null, 2)

  const selectedAction = props.resubmit ? resubmitApplicationAction : updateApplicationAction

  const [state, formAction, pending] = useFormAction(
    selectedAction,
    { ok: false, error: null },
    props.resubmit ? "申請を再提出しました" : "申請内容を変更しました",
    {
      onSuccess: () => {
        isDirty.current = false
        setOpen(false)
      },
    },
  )

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && isDirty.current) {
      const ok = window.confirm("編集中の内容は破棄されます。閉じてよろしいですか?")

      if (!ok) {
        return
      }

      isDirty.current = false
    }

    setOpen(nextOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button variant="secondary" size="sm" />}>
        {props.resubmit ? "修正して再申請" : "変更"}
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {props.resubmit ? "差戻し内容を修正して再申請" : "申請内容を変更"}
          </DialogTitle>

          <DialogDescription>申請内容を編集して保存してください。</DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="application_id" value={props.applicationId} />

          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="update_payload">申請内容</FieldLabel>

              <Textarea
                id="update_payload"
                name="payload"
                rows={8}
                defaultValue={initialPayload}
                onChange={(event) => {
                  isDirty.current = event.target.value !== initialPayload
                }}
              />
            </Field>
          </FieldGroup>

          {state.error === null ? null : <FieldError>{state.error}</FieldError>}

          <Button type="submit" disabled={pending}>
            {props.resubmit ? "再申請する" : "変更を保存"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** 申請取り下げボタン。Server Action を呼び、成功時はリストが revalidate される。 */
function WithdrawApplicationButton(props: { applicationId: EntityId }) {
  const [_state, formAction, pending] = useFormAction(
    withdrawApplicationAction,
    {
      ok: false,
      error: null,
    },
    "申請を取り下げました",
  )

  return (
    <ConfirmActionDialog
      action={formAction}
      triggerLabel="取り下げ"
      title="この申請を取り下げますか？"
      description="取り下げた申請は承認されません。この操作は元に戻せません。"
      confirmLabel="申請を取り下げ"
      pending={pending}
    >
      <input type="hidden" name="application_id" value={props.applicationId} />
    </ConfirmActionDialog>
  )
}
