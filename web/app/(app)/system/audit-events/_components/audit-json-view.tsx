"use client"

import { ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"

type Props = {
  label: string
  value: string | null
}

function displayJson(value: string | null): string {
  if (value === null) return "null"
  try {
    return JSON.stringify(JSON.parse(value), null, 2)
  } catch {
    return value
  }
}

export function AuditJsonView(props: Props) {
  return (
    <Collapsible>
      <CollapsibleTrigger render={<Button variant="ghost" className="w-full justify-between" />}>
        {props.label}
        <ChevronDown
          data-icon="inline-end"
          aria-hidden="true"
          className="group-data-[open]/collapsible:rotate-180"
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="border-t p-4">
          <pre
            tabIndex={0}
            aria-label={`${props.label}のJSON`}
            className="max-h-96 overflow-auto rounded-lg bg-muted p-4 text-xs whitespace-pre-wrap break-words"
          >
            <code>{displayJson(props.value)}</code>
          </pre>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
