"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import type { Transition } from "framer-motion"

export const SPRING_PRESET = {
  type: "spring",
  stiffness: 100,
  damping: 20,
} satisfies Transition

interface MotionContextValue {
  reduce: boolean
  spring: Transition
}

const MotionContext = createContext<MotionContextValue>({
  reduce: false,
  spring: SPRING_PRESET,
})

export function useMotionCtx() {
  return useContext(MotionContext)
}

interface MotionConfigProviderProps {
  children: ReactNode
}

export function MotionConfigProvider({ children }: MotionConfigProviderProps) {
  const [reduce, setReduce] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    setReduce(mq.matches)

    const handler = (e: MediaQueryListEvent) => setReduce(e.matches)
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [])

  return (
    <MotionContext.Provider value={{ reduce, spring: SPRING_PRESET }}>
      {children}
    </MotionContext.Provider>
  )
}
