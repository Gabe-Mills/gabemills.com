import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

/**
 * A free-floating bubble. Nothing contains it — it sits directly on the
 * constellation field and swells when you touch it.
 *
 * Unboxing the content only works because each bubble carries its own fill: at
 * chip scale the bubble IS the panel, so it brings the local contrast that a
 * wrapping card used to provide. That's why the fill can't go fully transparent
 * no matter how light the design wants to feel.
 *
 * Growth is a spring, not a duration — a bubble easing linearly to a new size
 * reads as a rectangle being scaled. Overshoot is what sells it as physical.
 * The whole effect collapses to nothing under prefers-reduced-motion.
 */
export default function Bubble({
  children,
  accent,
  href,
  size = "sm",
  className = "",
  title,
}: {
  children: ReactNode;
  accent?: string;
  href?: string;
  size?: "sm" | "lg";
  className?: string;
  title?: string;
}) {
  const reduced = useReducedMotion();
  const tint = accent ?? "#E4692C";

  const pad = size === "lg" ? "px-5 py-4" : "px-4 py-2.5";

  const content = (
    <>
      <span
        aria-hidden="true"
        className={`shrink-0 rounded-full ${size === "lg" ? "h-2.5 w-2.5" : "h-2 w-2"}`}
        style={{ background: tint, boxShadow: `0 0 8px ${tint}99` }}
      />
      <span className="min-w-0">{children}</span>
    </>
  );

  const shared = {
    className: `flex items-center gap-2.5 rounded-full border ${pad} ${className}`,
    style: {
      borderColor: `${tint}4D`,
      background: `${tint}14`,
      // inner top highlight — the detail that makes a pill read as a bubble
      // rather than an outlined rectangle with round ends
      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08), 0 6px 18px -8px rgba(4,3,3,0.7)",
      backdropFilter: "blur(6px)",
      WebkitBackdropFilter: "blur(6px)",
    } as const,
    whileHover: reduced ? undefined : { scale: size === "lg" ? 1.035 : 1.09 },
    whileTap: reduced ? undefined : { scale: 0.98 },
    transition: { type: "spring" as const, stiffness: 420, damping: 22, mass: 0.6 },
  };

  if (href) {
    return (
      <motion.a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        title={title}
        {...shared}
        className={`${shared.className} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFB15E] focus-visible:ring-offset-2 focus-visible:ring-offset-bg`}
      >
        {content}
      </motion.a>
    );
  }

  return (
    <motion.div title={title} {...shared}>
      {content}
    </motion.div>
  );
}
