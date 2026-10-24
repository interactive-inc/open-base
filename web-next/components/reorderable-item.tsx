"use client"

import { GripVertical } from "lucide-react"
import type { DragEvent, KeyboardEvent, ReactNode } from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { REORDER_DRAG_TYPE } from "@/lib/reorder/reorder-drag-type"

type Props = {
  index: number
  dragHandleLabel: string
  onMove: (fromIndex: number, toIndex: number) => void
  children: ReactNode
}

/**
 * 並べ替えできるリスト項目。左のハンドルをドラッグして他の項目へ落とすか、
 * ハンドルにフォーカスして上下キーを押すと onMove(移動元, 移動先) が呼ばれる
 */
export function ReorderableItem(props: Props) {
  const [isDropTarget, setIsDropTarget] = useState(false)

  function handleDragStart(event: DragEvent<HTMLButtonElement>) {
    event.dataTransfer.setData(REORDER_DRAG_TYPE, String(props.index))
    event.dataTransfer.effectAllowed = "move"
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") {
      return
    }

    event.preventDefault()

    props.onMove(props.index, props.index + (event.key === "ArrowUp" ? -1 : 1))
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    if (!event.dataTransfer.types.includes(REORDER_DRAG_TYPE)) {
      return
    }

    event.preventDefault()
    event.dataTransfer.dropEffect = "move"
    setIsDropTarget(true)
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    const rawFromIndex = event.dataTransfer.getData(REORDER_DRAG_TYPE)

    setIsDropTarget(false)

    if (rawFromIndex === "") {
      return
    }

    event.preventDefault()

    props.onMove(Number(rawFromIndex), props.index)
  }

  return (
    <div
      className={`flex items-start gap-2 rounded-2xl ${isDropTarget ? "ring-2 ring-ring/50" : ""}`}
      onDragOver={handleDragOver}
      onDragLeave={() => setIsDropTarget(false)}
      onDrop={handleDrop}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="mt-2 cursor-grab active:cursor-grabbing"
        aria-label={props.dragHandleLabel}
        draggable
        onDragStart={handleDragStart}
        onDragEnd={() => setIsDropTarget(false)}
        onKeyDown={handleKeyDown}
      >
        <GripVertical aria-hidden="true" />
      </Button>

      <div className="min-w-0 flex-1">{props.children}</div>
    </div>
  )
}
