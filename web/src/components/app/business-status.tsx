import { CheckIcon } from "lucide-react"
import {
  CATALOG_STATUS_TEXT,
  PROJECT_STATUS_TEXT,
  WORK_DEFINITION_STATUS_TEXT,
  WORK_OUTCOME_TEXT,
  type CatalogStatus,
  type ProjectStatus,
  type WorkDefinitionStatus,
  type WorkOutcome,
} from "@/components/app/business-types"
import { Badge } from "@/components/ui/badge"
import {
  Timeline,
  TimelineConnector,
  TimelineDescription,
  TimelineItem,
  TimelineMarker,
  TimelineTitle,
} from "@/components/ui/timeline"

/** 札の重さ。いま気にするもの、終わったもの、止まっているもの。 */
type Tone = "current" | "quiet" | "alert"

const VARIANT = {
  current: "secondary",
  quiet: "outline",
  alert: "destructive",
} as const satisfies Readonly<Record<Tone, string>>

function Tag({ text, tone }: { text: string; tone: Tone }) {
  return <Badge variant={VARIANT[tone]}>{text}</Badge>
}

const PROJECT_TONE: Readonly<Record<ProjectStatus, Tone>> = {
  planned: "current",
  active: "current",
  completed: "quiet",
  cancelled: "alert",
}

/** 案件の状態を短い札で見せる。 */
export function ProjectStatusLabel({ status }: { status: ProjectStatus }) {
  return <Tag text={PROJECT_STATUS_TEXT[status]} tone={PROJECT_TONE[status]} />
}

type StageStatus = "complete" | "current" | "upcoming"

const STAGE_TEXT: Readonly<Record<StageStatus, string>> = {
  complete: "済み",
  current: "いまここ",
  upcoming: "これから",
}

const STAGE_ORDER = ["planned", "active", "completed"] as const

/** 予定、進行中、完了の並びのうち、`index` 番目の段階がいまどうなっているか。 */
function stageStatus(status: (typeof STAGE_ORDER)[number], index: number): StageStatus {
  // 完了した案件は全部を済みにする。それ以外は今の段階だけを「いまここ」にする。
  const at = STAGE_ORDER.indexOf(status)
  if (status === "completed" || index < at) return "complete"
  return index === at ? "current" : "upcoming"
}

/**
 * 案件がいまどの段階かを横の並びで見せる。
 * 中止は予定から完了への並びの外にあるので、並びではなく警告の文で見せる。
 */
export function ProjectStage({ status, label }: { status: ProjectStatus; label: string }) {
  if (status === "cancelled") {
    return <p className="text-sm text-destructive">中止 · この案件は止まっています</p>
  }
  return (
    <Timeline aria-label={label} orientation="horizontal">
      {STAGE_ORDER.map((key, index) => {
        const stage = stageStatus(status, index)
        return (
          <TimelineItem key={key} value={key} status={stage}>
            <TimelineMarker>
              {stage === "complete" && <CheckIcon aria-hidden="true" />}
            </TimelineMarker>
            <TimelineConnector />
            <TimelineTitle>{PROJECT_STATUS_TEXT[key]}</TimelineTitle>
            <TimelineDescription>{STAGE_TEXT[stage]}</TimelineDescription>
          </TimelineItem>
        )
      })}
    </Timeline>
  )
}

const CATALOG_TONE: Readonly<Record<CatalogStatus, Tone>> = { active: "current", inactive: "quiet" }

/** 顧客やサービスの利用状態を札で見せる。 */
export function CatalogStatusLabel({ status }: { status: CatalogStatus }) {
  return <Tag text={CATALOG_STATUS_TEXT[status]} tone={CATALOG_TONE[status]} />
}

const OUTCOME_TONE: Readonly<Record<WorkOutcome, Tone>> = {
  succeeded: "quiet",
  failed: "alert",
  needs_review: "current",
}

/** 業務の実行の結果を札で見せる。 */
export function WorkOutcomeLabel({ outcome }: { outcome: WorkOutcome }) {
  return <Tag text={WORK_OUTCOME_TEXT[outcome]} tone={OUTCOME_TONE[outcome]} />
}

/** 業務の定義の利用状態を札で見せる。 */
export function WorkDefinitionStatusLabel({ status }: { status: WorkDefinitionStatus }) {
  return (
    <Tag
      text={WORK_DEFINITION_STATUS_TEXT[status]}
      tone={status === "active" ? "current" : "quiet"}
    />
  )
}

/** 工数の記録が取り消されたことを札で見せる。 */
export function VoidLabel() {
  return <Tag text="取消済み" tone="quiet" />
}
