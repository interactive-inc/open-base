/**
 * 詳細ページの「ラベル → 値」を1組ずつ並べる共通プリミティブ。
 * dl/dt/dd の見出し・値のリズムを統一する。
 */
type Props = {
  label: string
  children: React.ReactNode
  span?: "full"
}

export function DetailField(props: Props) {
  return (
    <div
      className={
        props.span === "full" ? "flex flex-col gap-2 sm:col-span-2" : "flex flex-col gap-2"
      }
    >
      <dt className="text-sm text-muted-foreground">{props.label}</dt>

      <dd className="text-sm font-medium">{props.children}</dd>
    </div>
  )
}
