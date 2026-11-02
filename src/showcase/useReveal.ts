import { useEffect, useRef } from "react";

/**
 * Adds `.is-in` to every `.sc-reveal` inside the returned ref once it scrolls into
 * view (once). One observer per section, not per element.
 *
 * Threshold is 0 on purpose: Chrome measures the target after its own clip-path, and
 * the hidden state `inset(0 0 100% 0)` has zero area, so any ratio above 0 never
 * fires. The bottom rootMargin makes "in view" mean ~12% up from the fold instead.
 */
export function useReveal<T extends HTMLElement>(amount = 0) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const els = Array.from(root.querySelectorAll<HTMLElement>(".sc-reveal"));
    if (root.classList.contains("sc-reveal")) els.push(root);
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("is-in");
            io.unobserve(e.target);
          }
        }
      },
      { threshold: amount, rootMargin: "0px 0px -12% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [amount]);
  return ref;
}
