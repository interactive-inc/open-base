const statusLabels: Readonly<Record<string, string>> = {
  confirmed: "確定",
  scheduled: "予定",
  corrected: "訂正済み",
  correction: "訂正",
  migration: "移行データ",
}

export function formatLifecycleDisplayStatus(status: string): string {
  return statusLabels[status] ?? status
}
