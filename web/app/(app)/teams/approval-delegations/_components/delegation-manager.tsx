"use client"

import type { EntityId } from "@/lib/api/types/entity-id"
import { useActionState } from "react"
import { toast } from "sonner"
import {
  createDelegationAction,
  deleteDelegationAction,
  type DelegationState,
} from "@/app/(app)/teams/approval-delegations/actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { formatDateTime } from "@/lib/format-date-time"

type Delegation = {
  id: EntityId
  delegator: { id: string; code: string | null; name: string } | null
  delegate: { id: string; code: string | null; name: string } | null
  template_code: string | null
  starts_at: string
  ends_at: string
  can_delete: boolean
}
const initial: DelegationState = { ok: false, error: null }

export function DelegationManager(props: { delegations: ReadonlyArray<Delegation> }) {
  const [createState, createAction, creating] = useActionState(
    async (state: DelegationState, data: FormData) => {
      const next = await createDelegationAction(state, data)
      if (next.ok) toast.success("代理承認を設定しました")
      else if (next.error) toast.error(next.error)
      return next
    },
    initial,
  )
  const [, deleteAction, deleting] = useActionState(
    async (state: DelegationState, data: FormData) => {
      const next = await deleteDelegationAction(state, data)
      if (next.ok) toast.success("代理承認設定を解除しました")
      else if (next.error) toast.error(next.error)
      return next
    },
    initial,
  )
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,24rem)_1fr]">
      <Card>
        <CardHeader>
          <CardTitle>代理承認を設定</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createAction}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="delegate-code">代理先の従業員コード</FieldLabel>
                <Input
                  id="delegate-code"
                  name="delegate_employee_code"
                  placeholder="E002"
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="delegate-template">テンプレートコード</FieldLabel>
                <Input
                  id="delegate-template"
                  name="template_code"
                  placeholder="空欄なら全テンプレート"
                />
                <FieldDescription>特定の申請だけを委任する場合に入力します。</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="delegate-start">開始</FieldLabel>
                <Input id="delegate-start" name="starts_at" type="datetime-local" required />
              </Field>
              <Field>
                <FieldLabel htmlFor="delegate-end">終了</FieldLabel>
                <Input id="delegate-end" name="ends_at" type="datetime-local" required />
              </Field>
              {createState.error ? <FieldError>{createState.error}</FieldError> : null}
              <Button type="submit" disabled={creating}>
                設定する
              </Button>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
      <div className="flex flex-col gap-4">
        {props.delegations.length === 0 ? (
          <Card>代理承認設定はありません。</Card>
        ) : (
          props.delegations.map((item) => (
            <Card key={item.id}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex flex-col gap-2">
                  <div className="font-medium">
                    {item.delegator?.name ?? "不明"} → {item.delegate?.name ?? "不明"}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    対象: {item.template_code ?? "全テンプレート"}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {formatDateTime(item.starts_at)} 〜 {formatDateTime(item.ends_at)}
                  </div>
                </div>
                {item.can_delete ? (
                  <form action={deleteAction}>
                    <input type="hidden" name="delegation_id" value={item.id} />
                    <Button type="submit" size="sm" variant="destructive" disabled={deleting}>
                      解除
                    </Button>
                  </form>
                ) : null}
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
