import { useState, type FormEvent } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import type { CurrentProfile } from "@/components/app/app-shell"
import { BackLink, Loaded, PageHeader } from "@/components/app/data-view"
import { DISCLOSURE_FIELDS } from "@/components/app/operations-audit"
import { formatDateTime } from "@/components/app/operations-format"
import type {
  AuditDisclosureCurrent,
  AuditDisclosureField,
  AuditDisclosurePolicy,
} from "@/components/app/operations-types"
import { Facts } from "@/components/app/operations-view"
import { useApiJson } from "@/components/app/use-api-json"
import type { Props } from "./disclosure.server"

type DisclosureProps = Omit<Props, "initial" | "scope"> & {
  scope?: string
  initial?: Props["initial"]
}

/** 監査の記録を読むとき、どの項目を見せるかの方針。公開はCLIかMCPで行い、ここでは今の版を見る。 */
export default function AuditDisclosure({
  email,
  pathname,
  scope = "*",
  initial,
}: DisclosureProps) {
  const profile = useApiJson<CurrentProfile>("/company/current-profile", initial?.profile)
  const policy = useApiJson<AuditDisclosureCurrent>(
    `/system/audit-disclosure-policies?scope=${encodeURIComponent(scope)}`,
    initial?.policy,
  )

  return (
    <>
      <BackLink href="/operations/audit">監査の記録の一覧</BackLink>
      <PageHeader
        title="監査の開示の方針"
        description="監査の記録を読む人に、どの項目まで見せるかの方針です。公開するたびに版が増え、前の版も残ります。"
      />
      <ScopeForm scope={scope} />
      <Loaded state={policy} fallback={<Skeleton className="h-48 w-full" />}>
        {(data) => <Current policy={data.policy} />}
      </Loaded>
    </>
  )
}

function ScopeForm({ scope }: { scope: string }) {
  const [value, setValue] = useState(scope === "*" ? "" : scope)
  const [error, setError] = useState<string | null>(null)

  function submit(event: FormEvent) {
    event.preventDefault()
    const next = value.trim()
    if (next !== "" && !/^[0-9a-f-]{36}$/i.test(next)) {
      setError("アカウントの番号（36文字）を入れるか、空にしてください。")
      return
    }
    location.assign(
      next === ""
        ? "/operations/audit/disclosure"
        : `/operations/audit/disclosure?scope=${encodeURIComponent(next)}`,
    )
  }

  return (
    <form noValidate onSubmit={submit} aria-label="方針の範囲">
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>方針の範囲</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Field invalid={error !== null}>
            <FieldLabel>読む人のアカウントの番号</FieldLabel>
            <Input value={value} onValueChange={setValue} maxLength={36} spellCheck={false} />
            <FieldDescription>空にすると、全員に向けた方針を見ます。</FieldDescription>
            {error !== null && <FieldError>{error}</FieldError>}
          </Field>
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit">切り替える</Button>
        </CardFooter>
      </Card>
    </form>
  )
}

function Current({ policy }: { policy: AuditDisclosurePolicy | null }) {
  if (policy === null) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>いまの方針</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p>この範囲の方針はまだ公開されていません。CLI か MCP で公開すると、ここに出ます。</p>
        </CardContent>
      </Card>
    )
  }
  const labels = (values: ReadonlyArray<string> | null) =>
    values === null ? "指定なし" : values.length === 0 ? "なし" : values.join("、")

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>いまの方針（第 {policy.revision} 版）</h2>
        </CardTitle>
        <div>
          <Badge variant={policy.enabled ? "outline" : "destructive"}>
            {policy.enabled ? "有効" : "止めています"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <Facts
          items={[
            ["見せる項目", labels(fieldLabels(policy.allowedFields))],
            ["対象の種類", labels(policy.allowedTargetTypes)],
            ["読む目的", labels(policy.allowedPurposes)],
            ["期限", policy.expiresAt === null ? "なし" : formatDateTime(policy.expiresAt)],
            ["公開した理由", policy.reason],
            ["公開した日時", formatDateTime(policy.recordedAt)],
            ["公開した人", policy.actorAccountId],
          ]}
        />
      </CardContent>
    </Card>
  )
}

function fieldLabels(keys: ReadonlyArray<AuditDisclosureField>): string[] {
  return DISCLOSURE_FIELDS.filter((field) => keys.includes(field.key)).map((field) => field.label)
}
