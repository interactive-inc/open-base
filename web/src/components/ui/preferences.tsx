"use client"

import { Preferences as PreferencesPrimitive, usePreference } from "@ui-sdk/react/preferences"
import type * as React from "react"

function Preferences(props: React.ComponentProps<typeof PreferencesPrimitive>) {
  return <PreferencesPrimitive data-slot="preferences" {...props} />
}

export { createLocalStorage, createPreference } from "@ui-sdk/core"
export { Preferences, usePreference }
