"use client";

import { useEffect, useRef, useState } from "react";

function prefersReducedMotion() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Smoothly animates a number toward `target`. The first render returns `target`
 * verbatim (so server and client markup match — no hydration mismatch); the
 * easing only kicks in when the value changes afterwards (e.g. on data refetch),
 * which gives the dashboard a live "ticking" feel. Respects reduced motion.
 */
export function useCountUp(target: number, duration = 700) {
  const [value, setValue] = useState(target);
  const fromRef = useRef(target);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const from = fromRef.current;
    fromRef.current = target;

    // Already at target (or target is not a usable number) — value state already
    // reflects it, so there is nothing to animate.
    if (from === target || !Number.isFinite(target)) {
      return;
    }

    // Reduced motion collapses to a single frame that lands on the target.
    const effectiveDuration = prefersReducedMotion() ? 0 : duration;
    const start = performance.now();
    const animate = (now: number) => {
      const t = effectiveDuration === 0 ? 1 : Math.min((now - start) / effectiveDuration, 1);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      setValue(from + (target - from) * eased);
      if (t < 1) {
        frameRef.current = requestAnimationFrame(animate);
      }
    };
    frameRef.current = requestAnimationFrame(animate);

    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [target, duration]);

  return value;
}
