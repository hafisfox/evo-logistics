"use client";

import { useCountUp } from "@/hooks/use-count-up";

interface AnimatedNumberProps {
  value: number;
  /** Custom formatter for the (in-flight) numeric value. Defaults to a rounded,
   *  locale-grouped integer. */
  format?: (value: number) => string;
  className?: string;
  duration?: number;
}

export function AnimatedNumber({ value, format, className, duration }: AnimatedNumberProps) {
  const animated = useCountUp(value, duration);
  const display = format
    ? format(animated)
    : Math.round(animated).toLocaleString("en-US");
  return <span className={className}>{display}</span>;
}
