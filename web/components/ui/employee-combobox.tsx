"use client"

import { useRef, useState, useTransition } from "react"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"
import type { EmployeeListItem } from "@/lib/api/types/employee-list-item"

type Props = {
  id: string
  value: EmployeeListItem | null
  onValueChange: (employee: EmployeeListItem | null) => void
  searchEmployees: (query: string) => Promise<ReadonlyArray<EmployeeListItem>>
  placeholder: string
  disabled: boolean
}

const SEARCH_DEBOUNCE_MS = 250

// 従業員名 / コードで GET /employees をインクリメンタル検索して 1 人選ぶコンボボックス。
// サーバ側検索のためクライアントフィルタは無効（filter={null}）。古い検索は AbortController で破棄し、
// 打鍵ごとの過剰リクエストは最小限の debounce で抑える。useEffect/useCallback は使わない。
export function EmployeeCombobox(props: Props) {
  const [searchResults, setSearchResults] = useState<ReadonlyArray<EmployeeListItem>>([])

  const [searchValue, setSearchValue] = useState("")

  const [isPending, startTransition] = useTransition()

  const abortControllerRef = useRef<AbortController | null>(null)

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const trimmedSearchValue = searchValue.trim()

  // 選択中の従業員が検索結果に含まれない場合でも候補に残し、選択表示が消えないようにする。
  const items =
    props.value === null || searchResults.some((employee) => employee.code === props.value?.code)
      ? searchResults
      : [...searchResults, props.value]

  function runSearch(query: string) {
    const controller = new AbortController()
    abortControllerRef.current?.abort()
    abortControllerRef.current = controller

    startTransition(async () => {
      const employees = await props.searchEmployees(query)

      if (controller.signal.aborted) {
        return
      }

      startTransition(() => {
        setSearchResults(employees)
      })
    })
  }

  function handleInputValueChange(
    nextSearchValue: string,
    eventDetails: { reason: string | undefined },
  ) {
    setSearchValue(nextSearchValue)

    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }

    if (nextSearchValue.trim() === "") {
      abortControllerRef.current?.abort()
      setSearchResults([])
      return
    }

    if (eventDetails.reason === "item-press") {
      return
    }

    debounceTimerRef.current = setTimeout(() => {
      runSearch(nextSearchValue.trim())
    }, SEARCH_DEBOUNCE_MS)
  }

  function getEmptyMessage() {
    if (trimmedSearchValue === "" || isPending || items.length > 0) {
      return null
    }

    return `「${trimmedSearchValue}」に一致する従業員が見つかりません`
  }

  const emptyMessage = getEmptyMessage()

  return (
    <Combobox
      items={items}
      value={props.value}
      itemToStringLabel={(employee: EmployeeListItem) => employee.name}
      filter={null}
      disabled={props.disabled}
      onValueChange={(nextValue: EmployeeListItem | null) => {
        props.onValueChange(nextValue)
        setSearchValue("")
      }}
      onInputValueChange={handleInputValueChange}
    >
      <ComboboxInput
        id={props.id}
        placeholder={props.placeholder}
        showClear={props.value !== null}
      />

      <ComboboxContent>
        <ComboboxEmpty>{emptyMessage}</ComboboxEmpty>

        <ComboboxList>
          {(employee: EmployeeListItem) => (
            <ComboboxItem key={employee.code} value={employee}>
              {employee.name}（{employee.code}・{employee.deptName ?? "部署未設定"}）
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
