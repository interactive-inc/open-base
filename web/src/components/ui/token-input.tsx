"use client"

import {
  TokenInputEditor as TokenInputEditorPrimitive,
  TokenInput as TokenInputPrimitive,
  TokenInputToken as TokenInputTokenPrimitive,
  TokenInputTokenRemove as TokenInputTokenRemovePrimitive,
} from "@ui-sdk/react/token-input"
import { cn } from "cn"
import { XIcon } from "lucide-react"
import type * as React from "react"

function TokenInput({ renderToken, ...props }: React.ComponentProps<typeof TokenInputPrimitive>) {
  return (
    <TokenInputPrimitive
      renderToken={
        renderToken ??
        ((token) => (
          <TokenInputToken>
            {token.label}
            <TokenInputTokenRemove />
          </TokenInputToken>
        ))
      }
      {...props}
    />
  )
}

function TokenInputEditor({
  className,
  ...props
}: React.ComponentProps<typeof TokenInputEditorPrimitive>) {
  return (
    <TokenInputEditorPrimitive
      className={(state) =>
        cn(
          "min-h-16 w-full min-w-0 whitespace-pre-wrap break-words rounded-xl border border-input bg-input/30 px-3 py-2.5 text-base leading-7 outline-none transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-[3px] aria-invalid:ring-destructive/20 data-disabled:cursor-not-allowed data-disabled:opacity-50 data-empty:before:pointer-events-none data-empty:before:text-muted-foreground data-empty:before:content-[attr(aria-placeholder)] md:text-sm dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function TokenInputToken({
  className,
  ...props
}: React.ComponentProps<typeof TokenInputTokenPrimitive>) {
  return (
    <TokenInputTokenPrimitive
      className={(state) =>
        cn(
          "mx-0.5 inline-flex items-center gap-1 whitespace-nowrap rounded-md bg-primary/10 px-1.5 align-baseline font-medium text-primary text-sm leading-6 data-pending:animate-pulse data-unresolved:bg-destructive/10 data-unresolved:text-destructive data-selected:ring-2 data-selected:ring-ring/50 [&_svg:not([class*='size-'])]:size-3.5 [&_svg]:pointer-events-none [&_svg]:shrink-0",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function TokenInputTokenRemove({
  className,
  children,
  ...props
}: React.ComponentProps<typeof TokenInputTokenRemovePrimitive>) {
  return (
    <TokenInputTokenRemovePrimitive
      className={(state) =>
        cn(
          "-me-0.5 inline-flex size-4 cursor-pointer items-center justify-center rounded-sm opacity-60 transition-opacity hover:opacity-100 data-disabled:hidden data-readonly:hidden [&_svg:not([class*='size-'])]:size-3",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    >
      {children ?? <XIcon aria-hidden="true" />}
    </TokenInputTokenRemovePrimitive>
  )
}

export type { TokenInputValue } from "@ui-sdk/react/token-input"
export {
  createTokenInputController,
  defaultCodec,
  fromText,
  toLabel,
  toText,
} from "@ui-sdk/react/token-input"
export { TokenInput, TokenInputEditor, TokenInputToken, TokenInputTokenRemove }
