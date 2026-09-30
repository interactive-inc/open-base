import { describe, expect, test } from "vite-plus/test"
import { withMovedItem } from "@/lib/array/with-moved-item"

describe("withMovedItem", () => {
  test("moves an item forward", () => {
    expect(withMovedItem(["a", "b", "c", "d"], 0, 2)).toEqual(["b", "c", "a", "d"])
  })

  test("moves an item backward", () => {
    expect(withMovedItem(["a", "b", "c", "d"], 3, 1)).toEqual(["a", "d", "b", "c"])
  })

  test("moves an item to the last position", () => {
    expect(withMovedItem(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"])
  })

  test("returns the same array when the indexes are equal", () => {
    const items = ["a", "b"]

    expect(withMovedItem(items, 1, 1)).toBe(items)
  })

  test("returns the same array when an index is out of range", () => {
    const items = ["a", "b"]

    expect(withMovedItem(items, -1, 0)).toBe(items)
    expect(withMovedItem(items, 0, 2)).toBe(items)
    expect(withMovedItem(items, 2, 0)).toBe(items)
  })

  test("does not mutate the source array", () => {
    const items = ["a", "b", "c"]

    withMovedItem(items, 2, 0)

    expect(items).toEqual(["a", "b", "c"])
  })
})
