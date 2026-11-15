import {
  FieldControl,
  FieldDescription as FieldDescriptionPrimitive,
  FieldError as FieldErrorPrimitive,
  FieldGroup as FieldGroupPrimitive,
  FieldLabel as FieldLabelPrimitive,
  FieldLegend as FieldLegendPrimitive,
  Field as FieldPrimitive,
  FieldSet as FieldSetPrimitive,
} from "@ui-sdk/react/field"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import type * as React from "react"
import { useMemo } from "react"
import { Separator } from "@/components/ui/separator"

function FieldSet({ className, ...props }: React.ComponentProps<typeof FieldSetPrimitive>) {
  return (
    <FieldSetPrimitive
      className={(state) =>
        cn(
          "flex flex-col gap-6 has-[>[data-slot=checkbox-group]]:gap-3 has-[>[data-slot=radio-group]]:gap-3",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function FieldLegend({
  className,
  variant = "legend",
  ...props
}: React.ComponentProps<typeof FieldLegendPrimitive> & {
  variant?: "legend" | "label"
}) {
  return (
    <FieldLegendPrimitive
      data-variant={variant}
      className={(state) =>
        cn(
          "mb-3 font-medium data-[variant=label]:text-sm data-[variant=legend]:text-base",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function FieldGroup({ className, ...props }: React.ComponentProps<typeof FieldGroupPrimitive>) {
  return (
    <FieldGroupPrimitive
      className={(state) =>
        cn(
          "group/field-group @container/field-group flex w-full flex-col gap-7 data-[slot=checkbox-group]:gap-3 *:data-[slot=field-group]:gap-4",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

const fieldVariants = cva("group/field flex w-full data-invalid:text-destructive gap-3", {
  variants: {
    orientation: {
      vertical: "flex-col *:w-full [&>.sr-only]:w-auto",
      horizontal:
        "flex-row items-center has-[>[data-slot=field-content]]:items-start *:data-[slot=field-label]:flex-auto has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px",
      responsive:
        "flex-col *:w-full @md/field-group:flex-row @md/field-group:items-center @md/field-group:*:w-auto @md/field-group:has-[>[data-slot=field-content]]:items-start @md/field-group:*:data-[slot=field-label]:flex-auto [&>.sr-only]:w-auto @md/field-group:has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px",
    },
  },
  defaultVariants: {
    orientation: "vertical",
  },
})

function Field({
  className,
  orientation = "vertical",
  "data-disabled": dataDisabled,
  "data-invalid": dataInvalid,
  ...props
}: React.ComponentProps<typeof FieldPrimitive> &
  VariantProps<typeof fieldVariants> & {
    "data-disabled"?: boolean
    "data-invalid"?: boolean
  }) {
  return (
    <FieldPrimitive
      // false のときは属性を出さない（data-disabled: / data-invalid: は属性の有無で当たる）
      data-disabled={dataDisabled || undefined}
      data-invalid={dataInvalid || undefined}
      data-orientation={orientation}
      className={(state) =>
        cn(
          fieldVariants({ orientation }),
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function FieldContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="field-content"
      className={cn("group/field-content flex flex-1 flex-col gap-1 leading-snug", className)}
      {...props}
    />
  )
}

function FieldLabel({ className, ...props }: React.ComponentProps<typeof FieldLabelPrimitive>) {
  return (
    <FieldLabelPrimitive
      className={(state) =>
        cn(
          "flex select-none items-center gap-2 font-medium text-sm leading-none peer-data-disabled:cursor-not-allowed peer-data-disabled:opacity-50",
          "group/field-label peer/field-label flex w-fit gap-2 leading-snug has-[>[data-slot=field]]:has-[:focus-visible]:border-ring has-[>[data-slot=field]]:has-[:focus-visible]:ring-[3px] has-[>[data-slot=field]]:has-[:focus-visible]:ring-ring/50 has-[>[data-slot=field]]:rounded-xl has-[>[data-slot=field]]:border has-data-checked:border-primary/30 has-data-checked:bg-primary/5 has-[>[data-slot=field]]:not-has-[:disabled,[data-disabled]]:hover:bg-input/40 *:data-[slot=field]:p-4 group-data-disabled/field:opacity-50 dark:has-data-checked:border-primary/20 dark:has-data-checked:bg-primary/10",
          "has-[>[data-slot=field]]:w-full has-[>[data-slot=field]]:flex-col",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function FieldTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="field-label"
      className={cn(
        "flex w-fit items-center gap-2 font-medium text-sm group-data-disabled/field:opacity-50",
        className,
      )}
      {...props}
    />
  )
}

function FieldDescription({
  className,
  ...props
}: React.ComponentProps<typeof FieldDescriptionPrimitive>) {
  return (
    <FieldDescriptionPrimitive
      className={(state) =>
        cn(
          "text-left font-normal text-muted-foreground text-sm leading-normal group-has-[[data-orientation=horizontal]]/field:text-balance [[data-variant=legend]+&]:-mt-1.5",
          "nth-last-2:-mt-1 last:mt-0",
          "[&>a:hover]:text-primary [&>a]:underline [&>a]:underline-offset-4",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function FieldSeparator({
  children,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  children?: React.ReactNode
}) {
  return (
    <div
      data-slot="field-separator"
      data-content={children ? true : undefined}
      className={cn(
        "relative -my-2 h-5 text-sm group-data-[variant=outline]/field-group:-mb-2",
        className,
      )}
      {...props}
    >
      <Separator className="absolute inset-0 top-1/2" />
      {children && (
        <span
          className="relative mx-auto block w-fit bg-background px-2 text-muted-foreground"
          data-slot="field-separator-content"
        >
          {children}
        </span>
      )}
    </div>
  )
}

function FieldError({
  className,
  children,
  errors,
  match,
  ...props
}: React.ComponentProps<typeof FieldErrorPrimitive> & {
  errors?: Array<{ message?: string } | undefined>
}) {
  const content = useMemo(() => {
    if (children) {
      return children
    }

    if (!errors?.length) {
      return null
    }

    const uniqueErrors = [...new Map(errors.map((error) => [error?.message, error])).values()]

    if (uniqueErrors?.length === 1) {
      return uniqueErrors[0]?.message
    }

    return (
      <ul className="ml-4 flex list-disc flex-col gap-1">
        {uniqueErrors.map(
          (error) => error?.message && <li key={error.message}>{error.message}</li>,
        )}
      </ul>
    )
  }, [children, errors])

  if (!content && match === undefined) {
    return null
  }

  return (
    <FieldErrorPrimitive
      match={match ?? true}
      role="alert"
      className={(state) =>
        cn(
          "font-normal text-destructive text-sm",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    >
      {content || undefined}
    </FieldErrorPrimitive>
  )
}

export { useFieldControl } from "@ui-sdk/react/field"
export {
  Field,
  FieldContent,
  FieldControl,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
  FieldTitle,
}
