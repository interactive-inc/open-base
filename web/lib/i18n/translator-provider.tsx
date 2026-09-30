"use client"

import { translate } from "@/lib/i18n/translate"
import { TranslatorContext } from "@/lib/i18n/translator-context"

type Props = {
  dictionary: Record<string, string>
  children: React.ReactNode
}

/**
 * root layout で取得した辞書をツリー下へ Context 経由で配る Provider。
 * `t` は `translate(dictionary, key, vars)` を束ねた関数。
 */
export function TranslatorProvider(props: Props) {
  function t(key: string, vars?: Record<string, string | number>): string {
    return translate(props.dictionary, key, vars)
  }

  return <TranslatorContext.Provider value={t}>{props.children}</TranslatorContext.Provider>
}
