import { labelOf } from "@/app/(app)/system/audit-events/_lib/label-of"

const clientLabels: Readonly<Record<string, string>> = {
  web: "Web",
  cli: "CLI",
  api: "API",
  system: "システム",
}

export function auditClientLabel(value: string): string {
  return labelOf(clientLabels, value)
}
