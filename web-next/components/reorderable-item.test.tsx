import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, test, vi } from "vite-plus/test"
import { ReorderableItem } from "@/components/reorderable-item"
import { REORDER_DRAG_TYPE } from "@/lib/reorder/reorder-drag-type"

afterEach(cleanup)

/**
 * happy-dom の DragEvent は dataTransfer を持たないため、使う API だけの代役を作る
 */
function createDataTransfer() {
  const values = new Map<string, string>()
  const types: Array<string> = []

  return {
    effectAllowed: "",
    dropEffect: "",
    types,
    setData(type: string, value: string) {
      values.set(type, value)

      if (!types.includes(type)) {
        types.push(type)
      }
    },
    getData(type: string) {
      return values.get(type) ?? ""
    },
  }
}

function toElement(node: Element | null | undefined): Element {
  if (node === null || node === undefined) {
    throw new Error("並べ替え対象の要素が見つからない")
  }

  return node
}

function renderItems(onMove: (fromIndex: number, toIndex: number) => void) {
  return render(
    <div>
      {["最初", "次"].map((label, index) => (
        <ReorderableItem
          key={label}
          index={index}
          dragHandleLabel={`${label}を並べ替え`}
          onMove={onMove}
        >
          <p>{label}</p>
        </ReorderableItem>
      ))}
    </div>,
  )
}

describe("ReorderableItem", () => {
  test("moves down with the arrow down key", () => {
    const onMove = vi.fn()
    renderItems(onMove)

    fireEvent.keyDown(screen.getByRole("button", { name: "最初を並べ替え" }), { key: "ArrowDown" })

    expect(onMove).toHaveBeenCalledWith(0, 1)
  })

  test("moves up with the arrow up key", () => {
    const onMove = vi.fn()
    renderItems(onMove)

    fireEvent.keyDown(screen.getByRole("button", { name: "次を並べ替え" }), { key: "ArrowUp" })

    expect(onMove).toHaveBeenCalledWith(1, 0)
  })

  test("ignores unrelated keys", () => {
    const onMove = vi.fn()
    renderItems(onMove)

    fireEvent.keyDown(screen.getByRole("button", { name: "最初を並べ替え" }), { key: "Enter" })

    expect(onMove).not.toHaveBeenCalled()
  })

  test("moves the dragged item to the drop target index", () => {
    const onMove = vi.fn()
    const rendered = renderItems(onMove)
    const dataTransfer = createDataTransfer()
    const dropTarget = toElement(toElement(rendered.container.firstElementChild).children[1])

    fireEvent.dragStart(screen.getByRole("button", { name: "最初を並べ替え" }), { dataTransfer })
    fireEvent.dragOver(dropTarget, { dataTransfer })
    fireEvent.drop(dropTarget, { dataTransfer })

    expect(dataTransfer.getData(REORDER_DRAG_TYPE)).toBe("0")
    expect(onMove).toHaveBeenCalledWith(0, 1)
  })

  test("ignores a drop that carries no reorder payload", () => {
    const onMove = vi.fn()
    const rendered = renderItems(onMove)
    const dataTransfer = createDataTransfer()
    const dropTarget = toElement(toElement(rendered.container.firstElementChild).children[1])

    fireEvent.drop(dropTarget, { dataTransfer })

    expect(onMove).not.toHaveBeenCalled()
  })
})
