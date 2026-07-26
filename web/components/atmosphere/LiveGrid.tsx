"use client";

import { useEffect, useRef } from "react";

/** Must match the CSS mesh in globals.css, or the snakes drift off the squares. */
const CELL = 24;
/** Body length, in cells. */
const TAIL = 14;
/** Milliseconds to cross one cell. */
const STEP_MS = 96;
/** Chance a snake turns instead of carrying straight on at a junction. */
const TURN = 0.32;
const AMBIENT = 6;

type Vec = { x: number; y: number };

type Trace = {
  /** Grid nodes, oldest first, newest last. */
  path: Vec[];
  dir: Vec;
  /** Progress into the next cell, 0..1. */
  t: number;
  /** Frames remaining; Infinity for the ambient ones. */
  life: number;
  /** Ambient traces run faint; burst traces start bright and fade out. */
  burst: boolean;
};

const DIRS: Vec[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

function turnFrom(dir: Vec): Vec {
  // Left or right, never a reversal — a trace that doubles back reads as a bug.
  return Math.random() < 0.5 ? { x: -dir.y, y: dir.x } : { x: dir.y, y: -dir.x };
}

/**
 * The mesh behind the page.
 *
 * Two layers. The CSS one (globals.css) recolours the squares around the
 * cursor. This canvas runs the traces: sparks that travel the grid lines,
 * turning at junctions, dragging a fading tail. Clicking throws four brighter
 * ones out of the node you hit.
 */
export function LiveGrid() {
  const meshRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // The pointer-reactive mesh.
  useEffect(() => {
    const el = meshRef.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    let x = window.innerWidth / 2;
    let y = window.innerHeight / 2;

    const paint = () => {
      frame = 0;
      el.style.setProperty("--mx", `${x}px`);
      el.style.setProperty("--my", `${y}px`);
      // Drift is a fraction of how far the pointer sits from centre, inverted,
      // so the mesh leans away from the cursor.
      el.style.setProperty("--gx", `${(0.5 - x / window.innerWidth) * 16}px`);
      el.style.setProperty("--gy", `${(0.5 - y / window.innerHeight) * 16}px`);
    };

    const onMove = (e: PointerEvent) => {
      x = e.clientX;
      y = e.clientY;
      if (!frame) frame = requestAnimationFrame(paint);
    };

    el.dataset.live = "true";
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  // The traces.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = 0;
    let h = 0;
    let cols = 0;
    let rows = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      cols = Math.ceil(w / CELL);
      rows = Math.ceil(h / CELL);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const spawnAmbient = (): Trace => {
      const start = { x: Math.floor(Math.random() * cols), y: Math.floor(Math.random() * rows) };
      return {
        path: [start],
        dir: DIRS[Math.floor(Math.random() * DIRS.length)],
        t: 0,
        life: Infinity,
        burst: false,
      };
    };

    resize();
    const traces: Trace[] = Array.from({ length: AMBIENT }, spawnAmbient);

    const onClick = (e: MouseEvent) => {
      const node = { x: Math.round(e.clientX / CELL), y: Math.round(e.clientY / CELL) };
      for (const dir of DIRS) {
        traces.push({ path: [node], dir, t: 0, life: 132, burst: true });
      }
      // Keep the canvas from accumulating bursts if someone hammers the page.
      while (traces.length > AMBIENT + 24) traces.splice(AMBIENT, 1);
    };
    window.addEventListener("click", onClick, { passive: true });
    window.addEventListener("resize", resize);

    let raf = 0;
    let last = performance.now();

    const draw = (now: number) => {
      const dt = Math.min(now - last, 64); // a backgrounded tab must not teleport
      last = now;
      ctx.clearRect(0, 0, w, h);

      for (let i = traces.length - 1; i >= 0; i--) {
        const tr = traces[i];
        tr.t += dt / STEP_MS;

        while (tr.t >= 1) {
          tr.t -= 1;
          if (Math.random() < TURN) tr.dir = turnFrom(tr.dir);
          const head = tr.path[tr.path.length - 1];
          const next = { x: head.x + tr.dir.x, y: head.y + tr.dir.y };

          // Wrap at the edges so a trace never simply stops at a wall.
          if (next.x < 0 || next.x > cols || next.y < 0 || next.y > rows) {
            if (tr.burst) {
              tr.life = 0;
              break;
            }
            tr.path.length = 0;
            next.x = (next.x + cols + 1) % (cols + 1);
            next.y = (next.y + rows + 1) % (rows + 1);
          }
          tr.path.push(next);
          if (tr.path.length > TAIL) tr.path.shift();
        }

        if (tr.life !== Infinity) {
          tr.life -= dt / 16.7;
          if (tr.life <= 0) {
            traces.splice(i, 1);
            continue;
          }
        }

        if (tr.path.length < 1) continue;

        // Fade of the whole snake: ambient ones are steady, bursts die out.
        const fade = tr.life === Infinity ? 1 : Math.min(1, tr.life / 60);
        const peak = (tr.burst ? 0.30 : 0.155) * fade;
        // A hair of inset keeps the body inside its square instead of bleeding
        // across the mesh lines.
        const pad = 1;
        const size = CELL - pad * 2;

        // The body: filled squares, brightest at the head, dying out at the tail.
        for (let s = 0; s < tr.path.length; s++) {
          const cell = tr.path[s];
          const k = (s + 1) / tr.path.length;
          ctx.fillStyle = `rgba(215, 27, 39, ${(peak * k * k).toFixed(3)})`;
          ctx.fillRect(cell.x * CELL + pad, cell.y * CELL + pad, size, size);
        }

        // The head, growing into the square it is entering.
        const head = tr.path[tr.path.length - 1];
        const hx = head.x * CELL + pad;
        const hy = head.y * CELL + pad;
        const grow = Math.max(0.001, tr.t);
        ctx.fillStyle = `rgba(215, 27, 39, ${(peak * 1.25).toFixed(3)})`;
        if (tr.dir.x === 1) ctx.fillRect(hx + CELL, hy, size * grow, size);
        else if (tr.dir.x === -1) ctx.fillRect(hx - CELL + size * (1 - grow), hy, size * grow, size);
        else if (tr.dir.y === 1) ctx.fillRect(hx, hy + CELL, size, size * grow);
        else ctx.fillRect(hx, hy - CELL + size * (1 - grow), size, size * grow);
      }

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("click", onClick);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <>
      <div ref={meshRef} className="live-grid pointer-events-none fixed inset-0 z-0" aria-hidden="true" />
      <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 z-0" aria-hidden="true" />
    </>
  );
}
