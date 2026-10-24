"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const DEFAULT_OPTIONS = [10, 20, 50, 100]

type Props = {
  /** 現在の表示件数 */
  currentSize: number
  /** 選択肢（省略時: 10, 20, 50, 100） */
  options?: number[]
}

/**
 * ページネーションの表示件数を切り替えるセレクタ。
 * 件数を変更すると ?size=N を付与し、?page= を削除（1 ページ目に戻る）して遷移する。
 */
export function PageSizeSelect(props: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const options = props.options ?? DEFAULT_OPTIONS

  function handleChange(value: string | null) {
    if (value === null) return

    const params = new URLSearchParams(searchParams.toString())

    params.set("size", value)
    params.delete("page")

    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <label htmlFor="page-size-select">表示</label>

      <Select value={String(props.currentSize)} onValueChange={handleChange}>
        <SelectTrigger size="sm" id="page-size-select">
          <SelectValue />
        </SelectTrigger>

        <SelectContent>
          {options.map((size) => (
            <SelectItem key={size} value={String(size)}>
              {size}件
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
