// このファイルは `bun run gen:composition` が生成する。手で編集しない。
import { runScheduledAttachmentPurge } from "@/api/scheduled/run-attachment-purge"
import { runScheduledAttachmentReconciliation } from "@/api/scheduled/run-attachment-reconciliation"

/** Workerの定期起動で実行するrunner。src/api/scheduled/run-*.ts から生成する。 */
export const SCHEDULED_JOBS = [
  runScheduledAttachmentPurge,
  runScheduledAttachmentReconciliation,
] as const
