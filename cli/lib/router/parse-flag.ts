import { UsageError } from "@/lib/errors"

const TOGGLE_FLAGS = new Set(["help", "unread", "password-stdin"])

/** 値の不足をtoggleと区別し、equals以降の値はflagとして再解釈しない。 */
export function parseFlag(argument: string, next: string | undefined) {
  const equals = argument.indexOf("=")
  const key = equals < 0 ? argument : argument.slice(0, equals)
  const isToggle = TOGGLE_FLAGS.has(key)
  const consumesNext = equals < 0 && (!isToggle || next === "true" || next === "false")
  const value = equals >= 0 ? argument.slice(equals + 1) : consumesNext ? next : "true"

  if (
    key === "" ||
    value === undefined ||
    (equals < 0 && !isToggle && value !== "-" && value.startsWith("-"))
  )
    throw new UsageError(
      `--${key} には値が必要です。-で始まる値は --${key}=<value> で指定してください`,
    )
  if (isToggle && value !== "true" && value !== "false")
    throw new UsageError(`--${key} は値なし、または true/false で指定してください`)

  return {
    key,
    value: isToggle && value === "false" ? null : value,
    consumed: consumesNext ? 2 : 1,
  }
}
