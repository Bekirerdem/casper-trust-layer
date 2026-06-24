/**
 * TDD: Reveal.test.tsx
 * RED → GREEN: with prefers-reduced-motion true, child renders immediately visible.
 */
import { render, screen } from '@testing-library/react'
import { describe, it, expect, afterEach, vi, beforeAll } from 'vitest'
import { Reveal } from '@/components/motion/Reveal'

// jsdom does not implement matchMedia — mock it.
function mockMatchMedia(prefersReduced: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)' ? prefersReduced : false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

// jsdom does not implement IntersectionObserver — stub it so framer-motion's
// whileInView doesn't throw when motion is allowed.
beforeAll(() => {
  if (typeof window.IntersectionObserver === 'undefined') {
    class IntersectionObserverStub {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    Object.defineProperty(window, 'IntersectionObserver', {
      writable: true,
      configurable: true,
      value: IntersectionObserverStub,
    })
  }
})

describe('Reveal', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders child immediately visible when prefers-reduced-motion is true', () => {
    mockMatchMedia(true)
    render(
      <Reveal>
        <p>hello world</p>
      </Reveal>
    )
    const child = screen.getByText('hello world')
    expect(child).toBeInTheDocument()
    // When reduced-motion, Reveal must render a plain <div> (not a framer motion
    // wrapper) with no hidden initial state — positively assert opacity:1 and
    // that the wrapper tag is a plain div (no data-framer-* or style="opacity:0").
    const wrapper = child.parentElement
    expect(wrapper?.tagName).toBe('DIV')
    expect(wrapper).toHaveStyle({ opacity: '1' })
  })

  it('renders child in a wrapper (motion div) when motion is allowed', () => {
    mockMatchMedia(false)
    render(
      <Reveal>
        <span>animated content</span>
      </Reveal>
    )
    expect(screen.getByText('animated content')).toBeInTheDocument()
  })
})
