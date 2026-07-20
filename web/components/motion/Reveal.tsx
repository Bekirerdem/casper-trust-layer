"use client"

import { useEffect, useState, type ReactNode } from "react"
import { motion } from "framer-motion"

interface RevealProps {
  children: ReactNode
  delay?: number
  className?: string
  /**
   * "view" (default) animates when scrolled into view; "mount" animates
   * immediately on mount — use for above-the-fold content, where the
   * IntersectionObserver can miss the initial paint and leave it hidden.
   */
  mode?: "view" | "mount"
}

function usePrefersReducedMotion(): boolean {
  const [reduce, setReduce] = useState(() => {
    if (typeof window === "undefined") return false
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches
  })

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    const handler = (e: MediaQueryListEvent) => setReduce(e.matches)
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [])

  return reduce
}

export function Reveal({ children, delay = 0, className, mode = "view" }: RevealProps) {
  const reduce = usePrefersReducedMotion()

  // When reduced-motion: render children with no animation (immediate, visible)
  if (reduce) {
    return <div className={className}>{children}</div>
  }

  const transition = {
    duration: 0.6,
    delay,
    ease: [0.16, 1, 0.3, 1] as const,
  }

  if (mode === "mount") {
    return (
      <motion.div
        className={className}
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={transition}
      >
        {children}
      </motion.div>
    )
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={transition}
    >
      {children}
    </motion.div>
  )
}
