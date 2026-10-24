/**
 * fromIndex の要素を toIndex の位置へ移した新しい配列を返す。
 * 添字が範囲外か移動が不要なときは元の配列をそのまま返す
 */
export function withMovedItem<T>(
  items: ReadonlyArray<T>,
  fromIndex: number,
  toIndex: number,
): ReadonlyArray<T> {
  if (fromIndex === toIndex) {
    return items
  }

  if (fromIndex < 0 || fromIndex >= items.length) {
    return items
  }

  if (toIndex < 0 || toIndex >= items.length) {
    return items
  }

  const moved = items[fromIndex]

  if (moved === undefined) {
    return items
  }

  const rest = items.filter((_, index) => index !== fromIndex)

  return [...rest.slice(0, toIndex), moved, ...rest.slice(toIndex)]
}
