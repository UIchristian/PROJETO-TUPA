import { useEffect, useState } from "react";

/** Animated count-up for monetary / numeric values. */
export function CountUp({
  to,
  duration = 900,
  prefix = "",
  format = (n: number) => Math.round(n).toLocaleString("pt-BR"),
  className,
}: {
  to: number;
  duration?: number;
  prefix?: string;
  format?: (n: number) => string;
  className?: string;
}) {
  const [val, setVal] = useState(0);

  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(to * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, duration]);

  return (
    <span className={className}>
      {prefix}
      {format(val)}
    </span>
  );
}
