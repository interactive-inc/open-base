"use client"

import type { EmployeeProfileVersion } from "@/lib/api/types/employee-profile-version"
import { LocaleField } from "@/app/(app)/my/settings/_components/locale-field"
import { PhoneField } from "@/app/(app)/my/settings/_components/phone-field"
import { ThemeModeField } from "@/app/(app)/my/settings/_components/theme-mode-field"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { Locale } from "@/lib/i18n/locale"

type Props = {
  locale: Locale
  phone: string | null
  profile: EmployeeProfileVersion | null
  profileCommandId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * 個人設定モーダル。表示テーマ・表示言語・電話番号を変更する。
 * ヘッダーのユーザーメニュー「設定」から開く。
 */
export function SettingsDialog(props: Props) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>設定</DialogTitle>

          <DialogDescription>表示や操作に関する個人設定を変更できます。</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-8">
          <ThemeModeField />

          <LocaleField locale={props.locale} />

          <PhoneField
            key={props.profile?.organizationRevision ?? "unlinked"}
            phone={props.phone}
            profile={props.profile}
            commandId={props.profileCommandId}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
