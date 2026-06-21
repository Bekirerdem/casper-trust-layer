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
    // When reduced-motion, the wrapper must have no animation applied:
    // we assert the element is present (opacity:1 default, no hidden state).
    const wrapper = child.parentElement
    // No initial animation means no inline opacity:0 style
    expect(wrapper).not.toHaveStyle({ opacity: '0' })
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
