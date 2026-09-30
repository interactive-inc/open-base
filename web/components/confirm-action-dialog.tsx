"use client"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"

type Props = {
  action: (formData: FormData) => void
  children: React.ReactNode
  triggerLabel: string
  title: string
  description: string
  confirmLabel: string
  pending: boolean
  size?: "sm" | "default"
  variant?: "default" | "destructive"
}

/** 恒久削除など、取り消せない Server Action の前に確認を挟む共通ダイアログ。 */
export function ConfirmActionDialog(props: Props) {
  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button
            variant={props.variant ?? "destructive"}
            size={props.size ?? "sm"}
            disabled={props.pending}
          />
        }
      >
        {props.triggerLabel}
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{props.title}</AlertDialogTitle>

          <AlertDialogDescription>{props.description}</AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel>やめる</AlertDialogCancel>

          <form action={props.action}>
            {props.children}

            <AlertDialogAction
              type="submit"
              variant={props.variant ?? "destructive"}
              disabled={props.pending}
            >
              {props.confirmLabel}
            </AlertDialogAction>
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
