"use client"

import { Download } from "lucide-react"
import { useRef, useState } from "react"
import { parseAuditExportSearchParams } from "@/app/(app)/system/audit-events/_lib/parse-audit-export-search-params"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import type { AuditListQuery } from "@/lib/api/types/audit-types"

type Props = {
  query: AuditListQuery
}

type Feedback = {
  message: string
  requestId: string | null
}

const errorMessages: Readonly<Record<number, string>> = {
  400: "出力条件を確認してください。",
  401: "ログインし直して、もう一度お試しください。",
  403: "CSV出力の権限がありません。",
  413: "出力期間または条件を狭めてください。",
  503: "時間をおいて、もう一度お試しください。",
}

function setOptional(params: URLSearchParams, key: string, value: string | number | undefined) {
  if (value !== undefined) params.set(key, String(value))
}

export function AuditExportForm(props: Props) {
  const fromRef = useRef<HTMLInputElement>(null)
  const toRef = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState(false)
  const [validation, setValidation] = useState<{
    field: "from" | "to" | "form"
    message: string
  } | null>(null)
  const [feedback, setFeedback] = useState<Feedback | null>(null)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return

    const parsed = parseAuditExportSearchParams({
      actor_account_id: props.query.actor_account_id,
      action: props.query.action,
      target_type: props.query.target_type,
      target_id: props.query.target_id,
      outcome: props.query.outcome,
      from: fromRef.current?.value ?? "",
      to: toRef.current?.value ?? "",
    })

    setFeedback(null)
    if (!parsed.ok) {
      setValidation(parsed)
      if (parsed.field === "from") fromRef.current?.focus()
      if (parsed.field === "to") toRef.current?.focus()
      return
    }

    setValidation(null)
    setPending(true)
    const params = new URLSearchParams({ from: parsed.request.from, to: parsed.request.to })
    setOptional(params, "actor_account_id", parsed.request.actor_account_id)
    setOptional(params, "action", parsed.request.action)
    setOptional(params, "target_type", parsed.request.target_type)
    setOptional(params, "target_id", parsed.request.target_id)
    setOptional(params, "outcome", parsed.request.outcome)

    try {
      const response = await fetch(`/system/audit-events/export?${params.toString()}`, {
        cache: "no-store",
      })
      const requestId = response.headers.get("X-Request-ID")

      if (!response.ok) {
        setFeedback({
          message: errorMessages[response.status] ?? "監査ログを出力できませんでした。",
          requestId,
        })
        return
      }

      const blob = await response.blob()
      const objectUrl = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = objectUrl
      link.download = "audit-events.csv"
      document.body.append(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(objectUrl)
      setFeedback({ message: "CSVの作成が完了しました。", requestId })
    } catch {
      setFeedback({ message: "時間をおいて、もう一度お試しください。", requestId: null })
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full rounded-xl bg-card border p-4 sm:min-w-xl">
      <FieldSet disabled={pending} className="gap-4">
        <FieldLegend>CSV出力</FieldLegend>
        <FieldGroup className="grid gap-4 sm:grid-cols-2">
          <Field data-invalid={validation?.field === "from" || undefined}>
            <FieldLabel htmlFor="audit-export-from">CSV開始日時</FieldLabel>
            <Input
              ref={fromRef}
              id="audit-export-from"
              name="from"
              defaultValue={props.query.from}
              placeholder="2026-07-01T00:00:00+09:00"
              autoComplete="off"
              spellCheck={false}
              aria-invalid={validation?.field === "from" || undefined}
            />
            {validation?.field === "from" ? <FieldError>{validation.message}</FieldError> : null}
          </Field>
          <Field data-invalid={validation?.field === "to" || undefined}>
            <FieldLabel htmlFor="audit-export-to">CSV終了日時</FieldLabel>
            <Input
              ref={toRef}
              id="audit-export-to"
              name="to"
              defaultValue={props.query.to}
              placeholder="2026-07-02T00:00:00+09:00"
              autoComplete="off"
              spellCheck={false}
              aria-invalid={validation?.field === "to" || undefined}
            />
            {validation?.field === "to" ? <FieldError>{validation.message}</FieldError> : null}
          </Field>
        </FieldGroup>
        <FieldDescription>オフセット付き日時で、31日以内の期間を指定します。</FieldDescription>
        {validation?.field === "form" ? <FieldError>{validation.message}</FieldError> : null}
        <Button type="submit" disabled={pending} className="self-start">
          {pending ? (
            <>
              <Spinner data-icon="inline-start" aria-hidden="true" />
              CSVを作成中…
            </>
          ) : (
            <>
              <Download data-icon="inline-start" aria-hidden="true" />
              CSVを出力
            </>
          )}
        </Button>
        <div aria-live="polite" className="text-sm">
          {feedback === null ? null : (
            <div className="flex flex-col gap-2">
              <p>{feedback.message}</p>
              {feedback.requestId === null ? null : (
                <p className="font-mono text-xs text-muted-foreground" translate="no">
                  問い合わせID: {feedback.requestId}
                </p>
              )}
            </div>
          )}
        </div>
      </FieldSet>
    </form>
  )
}
