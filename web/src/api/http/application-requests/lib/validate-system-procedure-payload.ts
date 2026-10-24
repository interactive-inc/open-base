import { InvalidApplicationPayloadError } from "@/api/http/application-requests/lib/errors"

type JsonObject = Record<string, unknown>

type FormFieldDefinition = {
  id: string
  type: "text" | "textarea" | "number" | "date" | "select"
  required: boolean
  options: ReadonlyArray<string> | null
}

/**
 * テンプレートの schema_json を信頼境界として payload を検証し、永続化用の値へ正規化する。
 * 現行の FormBuilder 形式だけを受け付ける。
 */
export function validateAndNormalizeApplicationPayload(
  schema: unknown,
  payload: unknown,
): JsonObject | InvalidApplicationPayloadError {
  if (isJsonObject(payload) === false) {
    return invalid("payload must be an object")
  }

  if (isJsonObject(schema) && "fields" in schema) {
    const fields = parseFormFields(schema.fields)
    if (fields instanceof Error) return fields

    return normalizeFormPayload(fields, payload)
  }

  return invalid("template schema must contain fields")
}

function parseFormFields(
  value: unknown,
): ReadonlyArray<FormFieldDefinition> | InvalidApplicationPayloadError {
  if (Array.isArray(value) === false) return invalid("template fields must be an array")

  const fields: Array<FormFieldDefinition> = []
  const ids = new Set<string>()

  for (const candidate of value) {
    if (
      isJsonObject(candidate) === false ||
      typeof candidate.id !== "string" ||
      candidate.id.length === 0 ||
      isFormFieldType(candidate.type) === false ||
      typeof candidate.required !== "boolean" ||
      (candidate.options !== null &&
        candidate.options !== undefined &&
        (Array.isArray(candidate.options) === false ||
          candidate.options.some((option) => typeof option !== "string")))
    ) {
      return invalid("template contains an invalid field definition")
    }

    if (ids.has(candidate.id)) return invalid("template contains duplicate field ids")
    ids.add(candidate.id)

    fields.push({
      id: candidate.id,
      type: candidate.type,
      required: candidate.required,
      options: Array.isArray(candidate.options) ? candidate.options : null,
    })
  }

  return fields
}

function normalizeFormPayload(
  fields: ReadonlyArray<FormFieldDefinition>,
  payload: JsonObject,
): JsonObject | InvalidApplicationPayloadError {
  const fieldIds = new Set(fields.map((field) => field.id))
  const unknownField = Object.keys(payload).find((key) => fieldIds.has(key) === false)
  if (unknownField !== undefined) return invalid(`payload contains unknown field: ${unknownField}`)

  const normalized: JsonObject = {}

  for (const field of fields) {
    const present = Object.hasOwn(payload, field.id)
    const value = payload[field.id]

    if (present === false || value === undefined || value === null || value === "") {
      if (field.required) return invalid(`payload is missing required field: ${field.id}`)
      continue
    }

    if (field.type === "number") {
      if (typeof value !== "number" || Number.isFinite(value) === false) {
        return invalid(`payload field has wrong type: ${field.id}`)
      }
    } else if (typeof value !== "string") {
      return invalid(`payload field has wrong type: ${field.id}`)
    }

    if (field.type === "date" && isIsoDate(value) === false) {
      return invalid(`payload field is not a valid date: ${field.id}`)
    }

    if (
      field.type === "select" &&
      (typeof value !== "string" ||
        field.options === null ||
        field.options.includes(value) === false)
    ) {
      return invalid(`payload field is not an allowed option: ${field.id}`)
    }

    normalized[field.id] = value
  }

  return normalized
}

function isFormFieldType(value: unknown): value is FormFieldDefinition["type"] {
  return (
    value === "text" ||
    value === "textarea" ||
    value === "number" ||
    value === "date" ||
    value === "select"
  )
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && Array.isArray(value) === false
}

function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || /^\d{4}-\d{2}-\d{2}$/.test(value) === false) return false

  const [year, month, day] = value.split("-").map(Number)
  const date = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 0))

  return (
    date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month && date.getUTCDate() === day
  )
}

function invalid(message: string): InvalidApplicationPayloadError {
  return new InvalidApplicationPayloadError(message)
}
