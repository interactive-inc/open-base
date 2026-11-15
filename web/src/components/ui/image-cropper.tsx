"use client"

import {
  type ImageCropperHandlePosition,
  ImageCropperFlip as ImageCropperFlipPrimitive,
  ImageCropperGrid as ImageCropperGridPrimitive,
  ImageCropperHandle as ImageCropperHandlePrimitive,
  ImageCropperImage as ImageCropperImagePrimitive,
  ImageCropper as ImageCropperPrimitive,
  ImageCropperRotate as ImageCropperRotatePrimitive,
  ImageCropperSelection as ImageCropperSelectionPrimitive,
  ImageCropperViewport as ImageCropperViewportPrimitive,
  ImageCropperZoom as ImageCropperZoomPrimitive,
} from "@ui-sdk/react/image-cropper"
import { cn } from "cn"
import { FlipHorizontal2Icon, FlipVertical2Icon, RotateCwIcon } from "lucide-react"
import type * as React from "react"

const handles: Record<ImageCropperHandlePosition, { label: string; className: string }> = {
  n: { label: "上辺", className: "top-0 left-1/2 cursor-ns-resize" },
  s: { label: "下辺", className: "top-full left-1/2 cursor-ns-resize" },
  e: { label: "右辺", className: "top-1/2 left-full cursor-ew-resize" },
  w: { label: "左辺", className: "top-1/2 left-0 cursor-ew-resize" },
  ne: { label: "右上の角", className: "top-0 left-full cursor-nesw-resize" },
  nw: { label: "左上の角", className: "top-0 left-0 cursor-nwse-resize" },
  se: {
    label: "右下の角",
    className: "top-full left-full cursor-nwse-resize",
  },
  sw: { label: "左下の角", className: "top-full left-0 cursor-nesw-resize" },
}

const iconButtonClassName =
  "inline-flex size-8 shrink-0 items-center justify-center rounded-4xl border border-border bg-input/30 text-foreground outline-none transition-colors hover:bg-input/50 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0"

function ImageCropper({ className, ...props }: React.ComponentProps<typeof ImageCropperPrimitive>) {
  return (
    <ImageCropperPrimitive
      className={(state) =>
        cn(
          "group/image-cropper flex w-full flex-col gap-3 data-disabled:opacity-50",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function ImageCropperViewport({
  className,
  ...props
}: React.ComponentProps<typeof ImageCropperViewportPrimitive>) {
  return (
    <ImageCropperViewportPrimitive
      className={(state) =>
        cn(
          "relative w-full touch-none select-none overflow-hidden rounded-xl bg-muted data-[mode=box]:aspect-[var(--image-cropper-aspect-ratio,4/3)] data-[mode=frame]:aspect-square data-error:aspect-[4/3] data-loading:animate-pulse",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function ImageCropperImage({
  className,
  ...props
}: React.ComponentProps<typeof ImageCropperImagePrimitive>) {
  return (
    <ImageCropperImagePrimitive
      className={(state) =>
        cn(
          "pointer-events-none max-w-none select-none data-loading:opacity-0",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function ImageCropperSelection({
  className,
  "aria-label": ariaLabel = "切り抜き範囲",
  "aria-roledescription": ariaRoleDescription = "切り抜き範囲",
  ...props
}: React.ComponentProps<typeof ImageCropperSelectionPrimitive>) {
  return (
    <ImageCropperSelectionPrimitive
      aria-label={ariaLabel}
      render={(selectionProps) => (
        <div {...selectionProps} aria-roledescription={ariaRoleDescription} />
      )}
      className={(state) =>
        cn(
          "cursor-move outline-2 outline-white shadow-[0_0_0_9999px_rgb(0_0_0/0.5)] focus-visible:outline-ring data-[mode=frame]:cursor-grab data-[shape=circle]:rounded-full data-disabled:cursor-default data-dragging:data-[mode=frame]:cursor-grabbing",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function ImageCropperGrid({
  className,
  children,
  ...props
}: React.ComponentProps<typeof ImageCropperGridPrimitive>) {
  return (
    <ImageCropperGridPrimitive
      className={(state) =>
        cn(
          "pointer-events-none absolute inset-0 opacity-0 transition-opacity data-dragging:opacity-100 data-[shape=circle]:overflow-hidden data-[shape=circle]:rounded-full",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    >
      {children ?? (
        <>
          <span className="absolute inset-y-0 left-1/3 w-px bg-white/60" />
          <span className="absolute inset-y-0 left-2/3 w-px bg-white/60" />
          <span className="absolute inset-x-0 top-1/3 h-px bg-white/60" />
          <span className="absolute inset-x-0 top-2/3 h-px bg-white/60" />
        </>
      )}
    </ImageCropperGridPrimitive>
  )
}

function ImageCropperHandle({
  className,
  position,
  "aria-label": ariaLabel,
  "aria-roledescription": ariaRoleDescription = "サイズ変更ハンドル",
  ...props
}: React.ComponentProps<typeof ImageCropperHandlePrimitive>) {
  const handle = handles[position]

  return (
    <ImageCropperHandlePrimitive
      position={position}
      aria-label={ariaLabel ?? `切り抜き範囲の${handle.label}`}
      render={(handleProps) => <div {...handleProps} aria-roledescription={ariaRoleDescription} />}
      className={(state) =>
        cn(
          "absolute size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-foreground/20 bg-white shadow-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 data-disabled:hidden",
          handle.className,
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function ImageCropperZoom({
  className,
  "aria-label": ariaLabel = "拡大率",
  ...props
}: React.ComponentProps<typeof ImageCropperZoomPrimitive>) {
  return (
    <ImageCropperZoomPrimitive
      aria-label={ariaLabel}
      className={(state) =>
        cn(
          "h-1.5 w-full min-w-0 cursor-pointer accent-primary outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function ImageCropperRotate({
  className,
  children,
  "aria-label": ariaLabel = "右に90度回転",
  ...props
}: React.ComponentProps<typeof ImageCropperRotatePrimitive>) {
  return (
    <ImageCropperRotatePrimitive
      aria-label={ariaLabel}
      className={(state) =>
        cn(iconButtonClassName, typeof className === "function" ? className(state) : className)
      }
      {...props}
    >
      {children ?? <RotateCwIcon aria-hidden="true" />}
    </ImageCropperRotatePrimitive>
  )
}

function ImageCropperFlip({
  className,
  children,
  direction = "horizontal",
  "aria-label": ariaLabel,
  ...props
}: React.ComponentProps<typeof ImageCropperFlipPrimitive>) {
  const vertical = direction === "vertical"

  return (
    <ImageCropperFlipPrimitive
      direction={direction}
      aria-label={ariaLabel ?? (vertical ? "上下反転" : "左右反転")}
      className={(state) =>
        cn(iconButtonClassName, typeof className === "function" ? className(state) : className)
      }
      {...props}
    >
      {children ??
        (vertical ? (
          <FlipVertical2Icon aria-hidden="true" />
        ) : (
          <FlipHorizontal2Icon aria-hidden="true" />
        ))}
    </ImageCropperFlipPrimitive>
  )
}

export type { ImageCrop } from "@ui-sdk/react/image-cropper"
export { createImageCropperController } from "@ui-sdk/react/image-cropper"
export {
  ImageCropper,
  ImageCropperFlip,
  ImageCropperGrid,
  ImageCropperHandle,
  ImageCropperImage,
  ImageCropperRotate,
  ImageCropperSelection,
  ImageCropperViewport,
  ImageCropperZoom,
}
