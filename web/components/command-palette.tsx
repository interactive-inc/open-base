"use client"

import type { PermissionKey } from "@/lib/api/types/permission-key"
import {
  BookOpen,
  Boxes,
  Briefcase,
  CalendarClock,
  CalendarDays,
  CalendarOff,
  ClipboardCheck,
  ClipboardList,
  Coins,
  DoorOpen,
  FileClock,
  FileText,
  GitBranch,
  GraduationCap,
  HandHelping,
  HeartHandshake,
  Inbox,
  KeyRound,
  LayoutDashboard,
  type LucideIcon,
  MessagesSquare,
  Package,
  PartyPopper,
  Plane,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Target,
  TimerReset,
  UserCog,
  UserMinus,
  Users,
  Wallet,
  Workflow,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import {
  CommandDialog,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import { canManageWorkflowRepairs } from "@/lib/application/can-manage-workflow-repairs"
import { canShowApplicationInboxCommand } from "@/lib/application/can-show-application-inbox-command"
import type { InboxCounts } from "@/lib/api/types/inbox-types"

type CommandEntry = {
  label: string
  href: string
  icon: LucideIcon
  group: string
  requiredPermission?: PermissionKey
  requiresWorkflowRepairAccess?: boolean
  workflowApplicationInbox?: boolean
}

/**
 * サイドバーと同じメニュー構造をフラットリストに展開したもの。
 * ⌘K で表示するコマンド候補として使う。
 */
const commands: ReadonlyArray<CommandEntry> = [
  { label: "ホーム", href: "/", icon: LayoutDashboard, group: "ナビゲーション" },
  {
    label: "申請の承認",
    href: "/inbox/applications",
    icon: Inbox,
    group: "受信箱",
    workflowApplicationInbox: true,
  },
  { label: "従業員一覧", href: "/company/employees", icon: Users, group: "人材" },
  {
    label: "従業員 新規登録",
    href: "/company/employees/new",
    icon: Users,
    group: "人材",
    requiredPermission: "employee:create",
  },
  { label: "部署・組織図", href: "/company/departments", icon: GitBranch, group: "人材" },
  { label: "自分の申請", href: "/my/applications", icon: FileText, group: "業務" },
  {
    label: "監査ログ",
    href: "/system/audit-events",
    icon: FileClock,
    group: "システム",
    requiredPermission: "audit:read",
  },
  {
    label: "ワークフロー修復",
    href: "/system/workflow-repairs",
    icon: Workflow,
    group: "システム",
    requiresWorkflowRepairAccess: true,
  },
  {
    label: "バッチ",
    href: "/system/batches",
    icon: Workflow,
    group: "システム",
    requiredPermission: "batch:view",
  },
  {
    label: "ロール",
    href: "/system/roles",
    icon: KeyRound,
    group: "システム",
    requiredPermission: "iam:read",
  },
  {
    label: "アカウント",
    href: "/system/accounts",
    icon: UserCog,
    group: "システム",
    requiredPermission: "iam:read",
  },
]

type Props = {
  inboxCounts: InboxCounts
  permissions: ReadonlyArray<PermissionKey>
}

/**
 * ⌘K（Ctrl+K）でどこからでも開けるグローバルコマンドパレット。
 * サイドバーと同じメニュー構造を検索し、Enter でページ遷移する。
 */
export function CommandPalette(props: Props) {
  const [open, setOpen] = useState(false)

  const router = useRouter()

  const permissionSet = new Set(props.permissions)

  const visibleCommands = commands.filter((command) => {
    if (
      command.workflowApplicationInbox === true &&
      canShowApplicationInboxCommand(props.permissions, props.inboxCounts.applications) === false
    ) {
      return false
    }

    if (
      command.requiresWorkflowRepairAccess === true &&
      canManageWorkflowRepairs(props.permissions) === false
    ) {
      return false
    }

    return command.requiredPermission === undefined || permissionSet.has(command.requiredPermission)
  })

  // グループ名とコマンドの順序を維持しつつ、描画時の再フィルタを避ける。
  const commandsByGroup = new Map<string, Array<CommandEntry>>()

  for (const command of visibleCommands) {
    const grouped = commandsByGroup.get(command.group)

    if (grouped === undefined) {
      commandsByGroup.set(command.group, [command])
    } else {
      grouped.push(command)
    }
  }

  const groups = [...commandsByGroup.keys()]

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setOpen((prev) => !prev)
      }
    }

    document.addEventListener("keydown", handleKeyDown)

    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [])

  const handleSelect = useCallback(
    (href: string) => {
      setOpen(false)
      router.push(href)
    },
    [router],
  )

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="コマンドパレット"
      description="メニューを検索してページに移動"
    >
      <Command>
        <CommandInput placeholder="ページを検索…" />

        <CommandList>
          <CommandEmpty>見つかりません</CommandEmpty>

          {groups.map((group, index) => (
            <div key={group}>
              {index > 0 ? <CommandSeparator /> : null}

              <CommandGroup heading={group}>
                {commandsByGroup.get(group)?.map((command) => {
                  const Icon = command.icon

                  return (
                    <CommandItem key={command.href} onSelect={() => handleSelect(command.href)}>
                      <Icon aria-hidden="true" />
                      <span>{command.label}</span>
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            </div>
          ))}
        </CommandList>
      </Command>
    </CommandDialog>
  )
}
