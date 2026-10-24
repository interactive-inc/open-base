import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldSet } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import type { AuditListQuery } from "@/lib/api/types/audit-types"

type Props = {
  query: AuditListQuery
}

export function AuditEventFilterForm(props: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>検索条件</CardTitle>
      </CardHeader>
      <CardContent>
        <form action="/system/audit-events" method="get">
          <FieldSet>
            <FieldGroup className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Field>
                <FieldLabel htmlFor="audit-actor-account-id">実行アカウントID</FieldLabel>
                <Input
                  id="audit-actor-account-id"
                  name="actor_account_id"
                  defaultValue={props.query.actor_account_id}
                  inputMode="numeric"
                  autoComplete="off"
                  spellCheck={false}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="audit-action">操作</FieldLabel>
                <Input
                  id="audit-action"
                  name="action"
                  defaultValue={props.query.action}
                  autoComplete="off"
                  spellCheck={false}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="audit-target-type">対象種別</FieldLabel>
                <Input
                  id="audit-target-type"
                  name="target_type"
                  defaultValue={props.query.target_type}
                  autoComplete="off"
                  spellCheck={false}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="audit-target-id">対象ID</FieldLabel>
                <Input
                  id="audit-target-id"
                  name="target_id"
                  defaultValue={props.query.target_id}
                  autoComplete="off"
                  spellCheck={false}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="audit-outcome">結果</FieldLabel>
                <NativeSelect
                  id="audit-outcome"
                  name="outcome"
                  defaultValue={props.query.outcome ?? ""}
                  className="w-full"
                >
                  <NativeSelectOption value="">すべて</NativeSelectOption>
                  <NativeSelectOption value="succeeded">成功</NativeSelectOption>
                  <NativeSelectOption value="denied">拒否</NativeSelectOption>
                  <NativeSelectOption value="failed">失敗</NativeSelectOption>
                </NativeSelect>
              </Field>
              <Field>
                <FieldLabel htmlFor="audit-from">開始日時</FieldLabel>
                <Input
                  id="audit-from"
                  name="from"
                  defaultValue={props.query.from}
                  placeholder="2026-07-01T00:00:00+09:00"
                  autoComplete="off"
                  spellCheck={false}
                />
                <FieldDescription>例: 2026-07-01T00:00:00+09:00</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="audit-to">終了日時</FieldLabel>
                <Input
                  id="audit-to"
                  name="to"
                  defaultValue={props.query.to}
                  placeholder="2026-07-02T00:00:00+09:00"
                  autoComplete="off"
                  spellCheck={false}
                />
                <FieldDescription>開始日時より後の時刻を指定します。</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="audit-limit">表示件数</FieldLabel>
                <NativeSelect
                  id="audit-limit"
                  name="limit"
                  defaultValue={props.query.limit}
                  className="w-full"
                >
                  <NativeSelectOption value="10">10件</NativeSelectOption>
                  <NativeSelectOption value="25">25件</NativeSelectOption>
                  <NativeSelectOption value="50">50件</NativeSelectOption>
                </NativeSelect>
              </Field>
            </FieldGroup>
            <div className="flex flex-wrap gap-2">
              <Button type="submit">検索</Button>
              <Button
                variant="secondary"
                nativeButton={false}
                render={
                  <Link href="/system/audit-events" prefetch={false} aria-label="条件をリセット" />
                }
              >
                リセット
              </Button>
            </div>
          </FieldSet>
        </form>
      </CardContent>
    </Card>
  )
}
