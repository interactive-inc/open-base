import {
  AccordionHeader as AccordionHeaderPrimitive,
  AccordionItem as AccordionItemPrimitive,
  AccordionPanel as AccordionPanelPrimitive,
  Accordion as AccordionPrimitive,
  AccordionTrigger as AccordionTriggerPrimitive,
} from "@ui-sdk/react/accordion"
import { cn } from "cn"
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react"
import type * as React from "react"

function Accordion({ className, ...props }: React.ComponentProps<typeof AccordionPrimitive>) {
  return (
    <AccordionPrimitive
      className={(state) =>
        cn(
          "flex w-full flex-col overflow-hidden rounded-2xl border",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function AccordionItem({
  className,
  ...props
}: React.ComponentProps<typeof AccordionItemPrimitive>) {
  return (
    <AccordionItemPrimitive
      className={(state) =>
        cn(
          "not-last:border-b data-open:bg-muted/50",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function AccordionTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof AccordionTriggerPrimitive>) {
  return (
    <AccordionHeaderPrimitive className="flex">
      <AccordionTriggerPrimitive
        className={(state) =>
          cn(
            "group/accordion-trigger relative flex flex-1 items-start justify-between gap-6 border border-transparent p-4 text-left font-medium text-sm outline-none transition-all hover:underline data-disabled:pointer-events-none data-disabled:opacity-50 **:data-[slot=accordion-trigger-icon]:ml-auto **:data-[slot=accordion-trigger-icon]:size-4 **:data-[slot=accordion-trigger-icon]:text-muted-foreground",
            typeof className === "function" ? className(state) : className,
          )
        }
        {...props}
      >
        {(state) => (
          <>
            {typeof children === "function" ? children(state) : children}
            <ChevronDownIcon
              data-slot="accordion-trigger-icon"
              className="pointer-events-none shrink-0 group-data-open/accordion-trigger:hidden"
            />
            <ChevronUpIcon
              data-slot="accordion-trigger-icon"
              className="pointer-events-none hidden shrink-0 group-data-open/accordion-trigger:inline"
            />
          </>
        )}
      </AccordionTriggerPrimitive>
    </AccordionHeaderPrimitive>
  )
}

function AccordionContent({
  className,
  children,
  ...props
}: Omit<React.ComponentProps<typeof AccordionPanelPrimitive>, "className"> & {
  className?: string
}) {
  return (
    <AccordionPanelPrimitive
      className="h-(--accordion-panel-height) overflow-hidden px-4 text-sm transition-[height] duration-200 ease-out data-ending-style:h-0 data-starting-style:h-0"
      {...props}
    >
      {(state) => (
        <div
          className={cn(
            "pt-0 pb-4 [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground [&_p:not(:last-child)]:mb-4",
            className,
          )}
        >
          {typeof children === "function" ? children(state) : children}
        </div>
      )}
    </AccordionPanelPrimitive>
  )
}

export { createAccordionController } from "@ui-sdk/react/accordion"
export { Accordion, AccordionContent, AccordionItem, AccordionTrigger }
