import type { ReactNode } from "react"

/** 項目名と値の並び。Cardの中に置く。値が無い項目は「なし」と出す。 */
export function Facts({ items }: { items: ReadonlyArray<readonly [string, ReactNode]> }) {
  return (
    <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[10rem_1fr]">
      {items.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="min-w-0 break-words">
            {value === null || value === undefined || value === "" ? "なし" : value}
          </dd>
        </div>
      ))}
    </dl>
  )
}
