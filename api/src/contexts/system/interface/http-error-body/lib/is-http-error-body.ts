import type { HTTPErrorBody } from "@system/interface/errors"

export function isHTTPErrorBody(value: unknown): value is HTTPErrorBody {
  if (typeof value !== "object" || value === null) return false
  const candidate = value as { error?: unknown; message?: unknown }
  return typeof candidate.error === "string" && typeof candidate.message === "string"
}
