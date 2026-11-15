import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  CodeBlock,
  CodeBlockActions,
  CodeBlockContent,
  CodeBlockCopyButton,
} from "@/components/ui/code-block"
import { Skeleton } from "@/components/ui/skeleton"
import type { CurrentProfile } from "@/components/app/app-shell"
import { BackLink, Loaded, PageHeader } from "@/components/app/data-view"
import { DISCLOSURE_FIELDS, prettyJson } from "@/components/app/operations-audit"
import { formatDateTime, OUTCOME } from "@/components/app/operations-format"
import type {
  AuditOutcome,
  CompanyAuditDetail,
  SystemAuditEvent,
} from "@/components/app/operations-types"
import { Facts } from "@/components/app/operations-view"
import { useApiJson } from "@/components/app/use-api-json"
import type { Props } from "./[id].server"

type DetailProps = Omit<Props, "initial" | "ledger"> & {
  ledger?: Props["ledger"]
  initial?: Props["initial"]
}

/** 監査の記録の一件。変更の前後と認可の根拠を、保存された文字のまま見せる。 */
export default function AuditEventDetail({
  email,
  pathname,
  id,
  ledger = "company",
  initial,
}: DetailProps) {
  const profile = useApiJson<CurrentProfile>("/company/current-profile", initial?.profile)
  const back = ledger === "system" ? "/operations/audit?ledger=system" : "/operations/audit"

  return (
    <>
      <BackLink href={back}>監査の記録の一覧</BackLink>
      {ledger === "company" ? (
        <CompanyEvent id={id} initial={initial?.company ?? undefined} />
      ) : (
        <SystemEvent id={id} initial={initial?.system ?? undefined} />
      )}
    </>
  )
}

function CompanyEvent(props: { id: string; initial: Props["initial"]["company"] | undefined }) {
  const event = useApiJson<CompanyAuditDetail>(
    `/company/audit-events/${encodeURIComponent(props.id)}`,
    props.initial ?? undefined,
  )

  return (
    <Loaded state={event} fallback={<Skeleton className="h-64 w-full" />}>
      {(data) => (
        <>
          <Heading action={data.action} outcome={data.outcome} />
          <FactsCard
            items={[
              ["日時", formatDateTime(data.created_at)],
              ["操作した人", data.actor_account_id],
              ["従業員番号", data.actor_employee_id],
              ["対象", [data.target_type, data.target_id].filter(Boolean).join(" ")],
              ["理由", data.reason_code],
              ["操作の経路", data.client_name],
              ["接続元", data.client_ip],
              ["要求の番号", data.request_id],
              ["記録の番号", data.event_id],
            ]}
          />
          <JsonCards
            values={[
              ["認可の根拠", data.authorization_json],
              ["変更前の値", data.before_json],
              ["変更後の値", data.after_json],
              ["付帯の情報", data.metadata_json],
            ]}
          />
        </>
      )}
    </Loaded>
  )
}

function SystemEvent(props: { id: string; initial: Props["initial"]["system"] | undefined }) {
  const event = useApiJson<SystemAuditEvent>(
    `/system/audit-events/${encodeURIComponent(props.id)}`,
    props.initial ?? undefined,
  )

  return (
    <Loaded state={event} fallback={<Skeleton className="h-64 w-full" />}>
      {(data) => {
        const redacted = DISCLOSURE_FIELDS.filter((field) =>
          data.redacted_fields.includes(field.key),
        )
        return (
          <>
            <Heading action={data.action} outcome={data.outcome} />
            {redacted.length > 0 && (
              <Alert role="status">
                <AlertDescription>
                  開示の方針により、次の項目を伏せています:{" "}
                  {redacted.map((field) => field.label).join("、")}
                </AlertDescription>
              </Alert>
            )}
            <FactsCard
              items={[
                ["日時", formatDateTime(data.occurred_at)],
                ["操作した人", data.actor_account_id],
                ["対象", [data.target_type, data.target_id].filter(Boolean).join(" ")],
                ["理由", data.reason_code],
                ["記録の番号", data.event_id],
              ]}
            />
            <JsonCards
              values={[
                ["認可の根拠", data.authorization_json],
                ["変更前の値", data.before_json],
                ["変更後の値", data.after_json],
                ["付帯の情報", data.metadata_json],
              ]}
            />
          </>
        )
      }}
    </Loaded>
  )
}

function Heading(props: { action: string; outcome: AuditOutcome }) {
  return (
    <PageHeader
      title={<span className="font-mono break-all">{props.action}</span>}
      badges={<Badge variant={OUTCOME[props.outcome].variant}>{OUTCOME[props.outcome].text}</Badge>}
    />
  )
}

function FactsCard({ items }: { items: Parameters<typeof Facts>[0]["items"] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>記録の内容</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Facts items={items} />
      </CardContent>
    </Card>
  )
}

/** 保存されたJSONを、値ごとに一枚ずつ見せる。値の無いものは出さない。 */
function JsonCards({ values }: { values: ReadonlyArray<readonly [string, string | null]> }) {
  const present = values.filter((entry): entry is readonly [string, string] => entry[1] !== null)
  if (present.length === 0) return null

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      {present.map(([label, value]) => {
        const text = prettyJson(value)
        return (
          <Card key={label}>
            <CardHeader>
              <CardTitle>
                <h2>{label}</h2>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CodeBlock size="sm">
                <CodeBlockActions>
                  <CodeBlockCopyButton value={text} aria-label={`${label}をコピー`} />
                </CodeBlockActions>
                <CodeBlockContent wrap>{text}</CodeBlockContent>
              </CodeBlock>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
