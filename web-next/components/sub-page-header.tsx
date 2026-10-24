/**
 * ハブレイアウト（受信箱・部署など）の配下ページで使う軽量見出し。
 * レイアウト側が h1 と SidebarTrigger を持つため、こちらは h2 とアクションのみを並べて
 * 見出しの重複を避ける。
 */
type Props = {
  title: string
  description?: string
  actions?: React.ReactNode
}

export function SubPageHeader(props: Props) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">{props.title}</h2>

        {props.description !== undefined ? (
          <p className="text-sm text-muted-foreground">{props.description}</p>
        ) : null}
      </div>

      {props.actions !== undefined ? (
        <div className="flex flex-wrap items-center gap-2">{props.actions}</div>
      ) : null}
    </div>
  )
}
