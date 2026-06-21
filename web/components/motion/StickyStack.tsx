"use client"

import { useEffect, useRef, type ReactNode } from "react"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"

gsap.registerPlugin(ScrollTrigger)

function usePrefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

interface StickyStackProps {
  /** Pass Card elements as children — each direct child becomes one sticky card. */
  children: ReactNode
  className?: string
}

/**
 * StickyStack — GSAP-only component (NO framer-motion inside this tree).
 *
 * Behaviour: cards pin one by one as the user scrolls. Each card scales down
 * slightly as the next one enters, creating a depth-stack illusion.
 * When prefers-reduced-motion: renders a flat list with no animation.
 */
export function StickyStack({ children, className }: StickyStackProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const reduce = usePrefersReducedMotion()

  useEffect(() => {
    if (reduce) return
    const container = containerRef.current
    if (!container) return

    const ctx = gsap.context(() => {
      const cardEls = Array.from(
        container.querySelectorAll<HTMLElement>(":scope > [data-sticky-card]")
      )
      if (cardEls.length < 2) return

      cardEls.forEach((card, i) => {
        // Pin each card until the last card reaches the top
        ScrollTrigger.create({
          trigger: card,
          start: "top top",
          endTrigger: cardEls[cardEls.length - 1],
          end: "top top",
          pin: true,
          pinSpacing: false,
        })

        // Scale + fade out as the NEXT card scrolls in (skip last card)
        if (i < cardEls.length - 1) {
          gsap.to(card, {
            scale: 0.92,
            opacity: 0.55,
            ease: "none",
            scrollTrigger: {
              trigger: cardEls[i + 1],
              start: "top bottom",
              end: "top top",
              scrub: true,
            },
          })
        }
      })
    }, container)

    return () => ctx.revert()
  }, [reduce])

  if (reduce) {
    // Flat accessible list — no animation, no JS
    return (
      <div className={className}>
        {children}
      </div>
    )
  }

  return (
    <div ref={containerRef} className={className}>
      {/* Wrap each child in a data-sticky-card sentinel */}
      {Array.isArray(children)
        ? (children as ReactNode[]).map((child, i) => (
            <div key={i} data-sticky-card="">
              {child}
            </div>
          ))
        : <div data-sticky-card="">{children}</div>}
    </div>
  )
}
