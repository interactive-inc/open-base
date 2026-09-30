import Link from "next/link"
import { Button } from "@/components/ui/button"

export type NotificationFilterValue = "all" | "unread" | "read"

type Props = {
  current: NotificationFilterValue
}

const options: ReadonlyArray<{ value: NotificationFilterValue; label: string }> = [
  { value: "all", label: "すべて" },
  { value: "unread", label: "未読" },
  { value: "read", label: "既読" },
]

/** 通知一覧のフィルタ。?filter= を付与した Link で RSC に遷移する（JS 不要）。 */
export function NotificationFilter(props: Props) {
  return (
    <div className="flex items-center gap-2" role="group" aria-label="通知フィルタ">
      {options.map((option) => {
        const isActive = option.value === props.current

        return isActive ? (
          <Button key={option.value} variant="secondary" size="sm" aria-current="page">
            {option.label}
          </Button>
        ) : (
          <Button
            key={option.value}
            variant="ghost"
            size="sm"
            nativeButton={false}
            render={
              <Link
                href={
                  option.value === "all"
                    ? "/notifications"
                    : `/notifications?filter=${option.value}`
                }
              />
            }
          >
            {option.label}
          </Button>
        )
      })}
    </div>
  )
}
