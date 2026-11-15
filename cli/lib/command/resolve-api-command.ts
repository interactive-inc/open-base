import type { ApiCommand, ApiCommandGroup } from "@/lib/command/types"

const ID_SEGMENT = /^(?!\.{1,2}$)[^\s/\\]{1,255}$/

type ResolvedApiCommand = { name: string; command: ApiCommand; ids: ReadonlyArray<string> }

/**
 * 位置引数の先頭から最も長く一致するコマンド名を選び、残りを経路の識別子として受け取る。
 * 識別子の数が経路と合わないときや、`.`・`..`・区切り文字で別の経路へ届く値は null にする。
 */
export function resolveApiCommand(
  group: ApiCommandGroup,
  segments: ReadonlyArray<string>,
): ResolvedApiCommand | null {
  const matches = Object.entries(group.commands)
    .filter((entry) => entry[0].split(" ").every((word, index) => segments[index] === word))
    .toSorted((left, right) => right[0].split(" ").length - left[0].split(" ").length)

  const match = matches[0]
  if (match === undefined) return null

  const ids = segments.slice(match[0].split(" ").length)

  const expected = [...match[1].path.matchAll(/:[A-Za-z]+/g)].length
  if (ids.length !== expected) return null
  if (!ids.every((id) => ID_SEGMENT.test(id))) return null

  return { name: match[0], command: match[1], ids }
}
