import { useEffect, useRef, useState } from "react";

/** Eases a number toward its target over ~500ms — the terminal-ticker feel. */
export function useCountUp(target: number | undefined): number | undefined {
  const [shown, setShown] = useState<number | undefined>(undefined);
  const fromRef = useRef(0);
  const rafRef = useRef(0);

  useEffect(() => {
    if (target === undefined) return;
    if (
      typeof matchMedia === "function" &&
      matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setShown(target);
      return;
    }
    const from = fromRef.current;
    const start = performance.now();
    const DURATION = 500;
    cancelAnimationFrame(rafRef.current);
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION);
      const eased = 1 - (1 - t) ** 3;
      const value = from + (target - from) * eased;
      setShown(value);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target]);

  return shown;
}
