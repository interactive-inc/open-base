"use client"

import { useContext } from "react"
import type { Translator } from "@/lib/i18n/translator-context"
import { TranslatorContext } from "@/lib/i18n/translator-context"

/**
 * Provider 配下から翻訳関数 `t` を取得する hook。
 * Provider の外から呼ばれた場合は throw する（実装ミス検出のため）。
 */
export function useTranslator(): Translator {
  const value = useContext(TranslatorContext)

  if (value === null) {
    throw new Error("useTranslator must be used within TranslatorProvider")
  }

  return value
}
