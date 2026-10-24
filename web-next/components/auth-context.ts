"use client"

import { createContext } from "react"
import type { MeResponse } from "@/lib/api/types/auth-types"

export const AuthContext = createContext<MeResponse | null>(null)
