import type { Phase, PhaseStatus } from "@/components/app/phase-bar"
import type {
  ReviewAssessment,
  ReviewHistoryEntry,
  ReviewPolicy,
  ReviewSheet,
  ReviewStatus,
  ReviewSummary,
} from "@/components/app/reviews-types"

/**
 * 評価シートの状態から、画面に出す段階・番・文言を決める。
 * 状態の遷移の正本は `ReviewSheetEntity`。ここはそれを読み替えるだけで、操作の可否はサーバーが決める。
 */

/** 見ている人とシートの関係。サーバーの一覧（本人のシート、判断待ち）から決める。 */
export type ReviewViewer = "owner" | "evaluator" | "other"

export const STATUS_TEXT: Readonly<Record<ReviewStatus, string>> = {
  draft: "目標を設定中",
  goals_pending: "目標の承認待ち",
  goals_returned: "目標の差し戻し",
  goals_rejected: "目標の却下",
  goals_approved: "自己評価中",
  evaluation_pending: "評価待ち",
  evaluation_returned: "自己評価の差し戻し",
  evaluation_rejected: "評価の却下",
  finalized: "確定",
  cancelled: "取消",
}

const PHASE_NAMES = [
  ["goals", "目標設定"],
  ["goals_approval", "目標の承認"],
  ["self", "自己評価"],
  ["evaluation", "上長評価"],
  ["finalized", "確定"],
] as const

const PHASE_STATUS: Readonly<Record<ReviewStatus, ReadonlyArray<PhaseStatus>>> = {
  draft: ["pending", "waiting", "waiting", "waiting", "waiting"],
  goals_returned: ["pending", "returned", "waiting", "waiting", "waiting"],
  goals_rejected: ["pending", "rejected", "waiting", "waiting", "waiting"],
  goals_pending: ["approved", "pending", "waiting", "waiting", "waiting"],
  goals_approved: ["approved", "approved", "pending", "waiting", "waiting"],
  evaluation_pending: ["approved", "approved", "approved", "pending", "waiting"],
  evaluation_returned: ["approved", "approved", "pending", "returned", "waiting"],
  evaluation_rejected: ["approved", "approved", "pending", "rejected", "waiting"],
  finalized: ["approved", "approved", "approved", "approved", "approved"],
  cancelled: ["waiting", "waiting", "waiting", "waiting", "waiting"],
}

/** 目標設定から確定までの五つの段階。 */
export function sheetPhases(status: ReviewStatus): ReadonlyArray<Phase> {
  return PHASE_NAMES.map(([key, name], index) => ({
    key,
    name,
    status: PHASE_STATUS[status][index] ?? "waiting",
  }))
}

export type ReviewTurn = {
  /** 次に動く人。`none` は確定か取消で、もう誰の番でもない。 */
  actor: "owner" | "evaluator" | "none"
  /** 「あなたの番」「評価者の番」のような短い札。 */
  who: string
  /** 次にすること。 */
  title: string
  description: string
}

/** いま誰の番で、次に何をすればよいか。 */
export function sheetTurn(sheet: ReviewSheet, viewer: ReviewViewer): ReviewTurn {
  const owner = (title: string, description: string): ReviewTurn => ({
    actor: "owner",
    who: viewer === "owner" ? "あなたの番" : "本人の番",
    title,
    description,
  })
  const evaluator = (mine: string, others: string, description: string): ReviewTurn => ({
    actor: "evaluator",
    who: viewer === "evaluator" ? "あなたの番" : "評価者の番",
    title: viewer === "evaluator" ? mine : others,
    description,
  })
  const done = (title: string, description: string): ReviewTurn => ({
    actor: "none",
    who: "完了",
    title,
    description,
  })

  switch (sheet.status) {
    case "draft":
      return sheet.goals.length === 0
        ? owner("目標を立てて提出する", "目標を追加し、重みの合計を100にしてから提出します。")
        : owner("目標を確かめて提出する", "提出すると、評価者が目標を確認します。")
    case "goals_returned":
    case "goals_rejected":
      return owner(
        "目標を直して出し直す",
        "評価者の理由を確かめ、目標を直してからもう一度提出します。",
      )
    case "goals_pending":
      return evaluator(
        "目標を確認して判断する",
        "評価者が目標を確認しています",
        "目標と重みが妥当かを確かめ、承認するか理由を添えて戻します。",
      )
    case "goals_approved":
      return sheet.self_assessments.length === 0
        ? owner(
            "実績と自己評価を書く",
            "目標ごとに実績、点数、根拠を書いて保存し、それから提出します。",
          )
        : owner("自己評価を提出する", "提出すると、評価者が目標ごとに評価を書きます。")
    case "evaluation_returned":
    case "evaluation_rejected":
      return owner(
        "自己評価を直して出し直す",
        "評価者の理由を確かめ、自己評価を直してからもう一度提出します。",
      )
    case "evaluation_pending":
      return evaluator(
        "目標ごとに評価を書いて判断する",
        "評価者が評価を書いています",
        "目標ごとに点数と根拠を書いて承認するか、理由を添えて戻します。",
      )
    case "finalized":
      return done("評価は確定しました", "確定した評価はもう変更できません。")
    case "cancelled":
      return done(
        "このシートは取り消されました",
        "続けるときは、CLI か MCP で新しいシートを作ります。",
      )
  }
}

/** 評価者の判断を待っている状態。 */
export function isPending(status: ReviewStatus): boolean {
  return status === "goals_pending" || status === "evaluation_pending"
}

/** 区分の名前。期間の方針に無い区分は、そのキーを出す。 */
export function sectionName(policy: ReviewPolicy, key: string): string {
  return policy.sections.find((section) => section.key === key)?.name ?? key
}

/** 尺度の値に付いた名前。名前が値と同じなら値だけを出す。 */
export function scoreText(policy: ReviewPolicy, score: number): string {
  const label = policy.scale.find((entry) => entry.value === score)?.label
  return label === undefined || label === String(score) ? String(score) : `${score}（${label}）`
}

type DecideDetail = {
  action?: unknown
  assessments?: unknown
  evaluation_summary?: unknown
}

function decideDetail(entry: ReviewHistoryEntry): DecideDetail {
  return entry.operation === "decide" && typeof entry.detail === "object" && entry.detail !== null
    ? (entry.detail as DecideDetail)
    : {}
}

export type EvaluatorReview = {
  assessments: ReadonlyArray<ReviewAssessment>
  summary: ReviewSummary | null
  created_at: string
}

/**
 * 評価者の評価は判断の記録にだけ残る。最後に自己評価を提出したあとの、評価の承認の記録を読む。
 * 段階が複数あるときは、最後に承認した評価者の評価を返す。
 */
export function evaluatorReview(
  history: ReadonlyArray<ReviewHistoryEntry>,
): EvaluatorReview | null {
  let found: EvaluatorReview | null = null
  for (const entry of history) {
    if (entry.operation === "submit_evaluation") found = null
    const detail = decideDetail(entry)
    if (detail.action === "approve" && Array.isArray(detail.assessments)) {
      found = {
        assessments: detail.assessments as ReadonlyArray<ReviewAssessment>,
        summary:
          typeof detail.evaluation_summary === "object" && detail.evaluation_summary !== null
            ? (detail.evaluation_summary as ReviewSummary)
            : null,
        created_at: entry.created_at,
      }
    }
  }
  return found
}

/** 最後に戻された判断。差し戻しと却下の理由を本人に見せるために使う。 */
export function latestReturn(
  history: ReadonlyArray<ReviewHistoryEntry>,
): { action: "return" | "reject"; reason: string; created_at: string } | null {
  for (const entry of [...history].reverse()) {
    const action = decideDetail(entry).action
    if (action === "return" || action === "reject")
      return { action, reason: entry.reason, created_at: entry.created_at }
  }
  return null
}

const OPERATION_TEXT: Readonly<Record<ReviewHistoryEntry["operation"], string>> = {
  create_sheet: "シートを作成",
  revise_goals: "目標を変更",
  reopen_goals: "目標を見直しに戻す",
  self_evaluate: "自己評価を保存",
  submit_goals: "目標を提出",
  submit_evaluation: "自己評価を提出",
  cancel: "取り消し",
  decide: "判断",
}

const DECISION_TEXT: Readonly<Record<string, string>> = {
  approve: "承認",
  return: "差し戻し",
  reject: "却下",
}

/** 履歴の一件の操作名。判断は承認・差し戻し・却下に分ける。 */
export function operationText(entry: ReviewHistoryEntry): string {
  const action = decideDetail(entry).action
  if (entry.operation === "decide" && typeof action === "string")
    return DECISION_TEXT[action] ?? OPERATION_TEXT.decide
  return OPERATION_TEXT[entry.operation] ?? entry.operation
}

const APPROVER_TEXT: Readonly<Record<string, string>> = {
  direct_manager: "直属の上長",
  department_manager: "部門長",
  target_department_manager: "対象部門の長",
  management_chain: "上位の管理者を順に",
  employee: "指定した従業員",
  responsibility: "指定した責任を持つ人",
}

/** 承認経路の段階で、誰が判断するか。 */
export function approverText(approvers: ReadonlyArray<{ type: string }>): string {
  if (approvers.length === 0) return "会社の規程で決まる人"
  return approvers.map((approver) => APPROVER_TEXT[approver.type] ?? approver.type).join("、")
}

/** 期間を「2026年10月1日 〜 2027年3月31日」の形にする。 */
export function formatPeriod(startsOn: string, endsOn: string): string {
  const format = (value: string) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
    return match === null
      ? value
      : `${Number(match[1])}年${Number(match[2])}月${Number(match[3])}日`
  }
  return `${format(startsOn)} 〜 ${format(endsOn)}`
}

/** 従業員の識別子を短く見せる。名前は評価のAPIから読めない。 */
export function employeeText(employeeId: string): string {
  return `従業員 ${employeeId.length > 8 ? employeeId.slice(0, 8) : employeeId}`
}
