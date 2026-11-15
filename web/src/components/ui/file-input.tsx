"use client"

import {
  FileInputDropzone as FileInputDropzonePrimitive,
  FileInputItem as FileInputItemPrimitive,
  FileInputItemRemove as FileInputItemRemovePrimitive,
  FileInputList as FileInputListPrimitive,
  FileInput as FileInputPrimitive,
  FileInputTrigger as FileInputTriggerPrimitive,
  formatFileSize,
} from "@ui-sdk/react/file-input"
import { cn } from "cn"
import { FileIcon, UploadIcon, XIcon } from "lucide-react"
import type * as React from "react"

function FileInput({ className, ...props }: React.ComponentProps<typeof FileInputPrimitive>) {
  return (
    <FileInputPrimitive
      className={(state) =>
        cn(
          "flex w-full flex-col gap-3 data-disabled:cursor-not-allowed data-disabled:opacity-50",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function FileInputTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof FileInputTriggerPrimitive>) {
  return (
    <FileInputTriggerPrimitive
      className={(state) =>
        cn(
          "inline-flex h-8 w-fit shrink-0 select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-4xl border border-border bg-input/30 px-3 font-medium text-sm outline-none transition-all hover:bg-input/50 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-[3px] aria-invalid:ring-destructive/20 data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    >
      {children ?? (
        <>
          <UploadIcon aria-hidden="true" />
          ファイルを選択
        </>
      )}
    </FileInputTriggerPrimitive>
  )
}

function FileInputDropzone({
  className,
  ...props
}: React.ComponentProps<typeof FileInputDropzonePrimitive>) {
  return (
    <FileInputDropzonePrimitive
      className={(state) =>
        cn(
          "flex w-full flex-col items-center justify-center gap-2 rounded-2xl border border-input border-dashed bg-input/10 p-6 text-center text-muted-foreground text-sm transition-colors has-[:focus-visible]:border-ring data-drag-accept:border-primary data-dragging:border-ring data-drag-reject:border-destructive data-drag-accept:bg-primary/5 data-drag-reject:bg-destructive/5 data-disabled:pointer-events-none [&>svg:not([class*='size-'])]:size-6",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function FileInputList({
  className,
  ...props
}: React.ComponentProps<typeof FileInputListPrimitive>) {
  return (
    <FileInputListPrimitive
      className={(state) =>
        cn(
          "flex w-full flex-col gap-1.5 rounded-xl outline-none empty:hidden",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function FileInputItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof FileInputItemPrimitive>) {
  return (
    <FileInputItemPrimitive
      className={(state) =>
        cn(
          "flex w-full min-w-0 items-center gap-2.5 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 [&>svg:not([class*='size-'])]:size-4 [&>svg]:shrink-0 [&>svg]:text-muted-foreground",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    >
      {children ??
        ((state) => (
          <>
            <FileIcon aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate">{state.file.name}</span>
            <span className="shrink-0 text-muted-foreground text-xs tabular-nums">
              {formatFileSize(state.file.size)}
            </span>
            <FileInputItemRemove aria-label={`${state.file.name}を削除`} />
          </>
        ))}
    </FileInputItemPrimitive>
  )
}

function FileInputItemRemove({
  className,
  children,
  ...props
}: React.ComponentProps<typeof FileInputItemRemovePrimitive>) {
  return (
    <FileInputItemRemovePrimitive
      className={(state) =>
        cn(
          "-me-1 inline-flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none data-disabled:opacity-50 [&_svg:not([class*='size-'])]:size-3.5 [&_svg]:pointer-events-none",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    >
      {children ?? <XIcon aria-hidden="true" />}
    </FileInputItemRemovePrimitive>
  )
}

export { createFileInputController, relativePath } from "@ui-sdk/react/file-input"
export {
  FileInput,
  FileInputDropzone,
  FileInputItem,
  FileInputItemRemove,
  FileInputList,
  FileInputTrigger,
  formatFileSize,
}
