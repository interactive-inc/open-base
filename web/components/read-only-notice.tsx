import { Terminal } from "lucide-react"

type Props = {
  command: string | null
}

/**
 * 読み取り専用ページの末尾に置く、変更手段の案内。
 * Company の正本は API と CLI が持ち、Web は表示だけを担うことを明示する。
 * command が null のときは対応する CLI コマンドが未実装なので、手段だけを示す。
 */
export function ReadOnlyNotice(props: Props) {
  return (
    <div className="flex items-start gap-2 rounded-2xl border border-dashed bg-muted/40 p-4">
      <Terminal className="mt-2 size-4 shrink-0 text-muted-foreground" />

      <p className="text-sm text-muted-foreground">
        この画面は読み取り専用です。変更は
        {props.command === null ? (
          " CLI から行います。"
        ) : (
          <>
            {" CLI の "}
            <code className="rounded bg-muted px-2 py-2 font-mono text-xs">{props.command}</code>
            {" で行います。"}
          </>
        )}
      </p>
    </div>
  )
}
