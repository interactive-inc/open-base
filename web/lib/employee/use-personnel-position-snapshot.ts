"use client"

import { useRef, useState } from "react"
import { loadPersonnelPositionSnapshot } from "@/app/(app)/company/employees/load-personnel-position-snapshot"
import type { PersonnelPositionOption } from "@/lib/api/types/personnel-position-option"

type Snapshot = {
  companyRevision: number
  effectiveOn: string
  positions: ReadonlyArray<PersonnelPositionOption>
}

/** 日付変更前の選択肢と、遅れて到着した別の日付の応答を採用しない。 */
export function usePersonnelPositionSnapshot(companyRevision: number) {
  const [effectiveOn, setEffectiveOn] = useState("")
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const requestSequence = useRef(0)
  const isReady =
    snapshot !== null &&
    snapshot.effectiveOn === effectiveOn &&
    snapshot.companyRevision === companyRevision

  async function changeEffectiveOn(date: string) {
    const sequence = ++requestSequence.current
    setEffectiveOn(date)
    setSnapshot(null)
    setError(null)
    if (date === "") return
    try {
      const response = await loadPersonnelPositionSnapshot(companyRevision, date)
      if (sequence !== requestSequence.current) return
      if (!response.ok) {
        setError(response.error)
        return
      }
      if (response.companyRevision !== companyRevision || response.effectiveOn !== date) {
        setError("確認した会社版・有効日と役職情報が一致しません")
        return
      }
      setSnapshot(response)
    } catch {
      if (sequence === requestSequence.current) setError("役職情報を取得できませんでした")
    }
  }

  return {
    effectiveOn,
    isReady,
    error,
    positions: isReady ? snapshot.positions : [],
    changeEffectiveOn,
  }
}
