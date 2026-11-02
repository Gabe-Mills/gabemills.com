import { useEffect, useRef, useState } from "react";
import { mountIntro } from "../intro";

/**
 * Engraved scroll intro (branch intro-engraved).
 *
 * A woodcut-comic prologue in the site's own palette: ground as ink, ember as the
 * woodcut red. It is a tall section with a sticky canvas, so it scrolls like the rest
 * of the page and the hero below takes over where it fades to ground. The rendering
 * lives in src/intro (plain three.js, one canvas); this component only mounts it.
 *
 * Reduced motion skips it entirely and the page opens on the hero, which already
 * says everything the intro says.
 */
export default function EngravedIntro() {
  const ref = useRef<HTMLElement>(null);
  const [reduced] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    if (reduced || !ref.current) return;
    const handle = mountIntro(ref.current, { onSkipTo: "#top" });
    return () => handle.destroy();
  }, [reduced]);

  if (reduced) return null;
  return <section ref={ref} id="intro" aria-label="Intro: Gabe Mills, in five engraved panels" />;
}
