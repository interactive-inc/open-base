export function labelOf(labels: Readonly<Record<string, string>>, value: string | null): string {
  if (value === null) return "—"
  return labels[value] ?? value
}
