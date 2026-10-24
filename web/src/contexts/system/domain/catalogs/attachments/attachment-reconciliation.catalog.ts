/** 添付本体の実在照合をSystem batch jobとして記録する名前。 */
export const ATTACHMENT_RECONCILIATION_JOB_NAME = "system.attachment.reconciliation"

/** 照合結果のSystem通知の種別と参照元の種別。 */
export const ATTACHMENT_RECONCILIATION_NOTIFICATION_KIND = "system:attachment.reconciliation"
export const ATTACHMENT_RECONCILIATION_SOURCE_TYPE = "system:batch-job"

/** 照合結果を通知する相手が持つpermission。global割当だけを対象にする。 */
export const ATTACHMENT_RECONCILIATION_RECIPIENT_PERMISSIONS = [
  "batch:view",
  "system:admin",
] as const

/** 終わらないまま残った実行を失敗として閉じ、次の実行を始められるようにするまでの時間。 */
export const ATTACHMENT_RECONCILIATION_LEASE_MILLISECONDS = 15 * 60 * 1000

/** 実行記録と通知本文に載せる欠損添付IDの上限。件数は別に全数を記録する。 */
export const ATTACHMENT_RECONCILIATION_REPORTED_ID_LIMIT = 100
