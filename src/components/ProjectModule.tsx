import { forwardRef } from "react";
import type { Project } from "../data/projects";

interface Props {
  project: Project;
  /** locked = dim, sealed look; active = forward and readable */
  state?: "locked" | "active" | "idle";
  className?: string;
  style?: React.CSSProperties;
}

/**
 * One project as a card in the pinned cinematic sequence.
 *
 * Visual-index rules (11 Sep 2026): screenshot, name, host. Nothing else.
 * The summary paragraph, stack chips, status chip and the tag/MOD readout were
 * removed — they were the bulk of the page's remaining word count, and they are
 * unreadable at the scale this card spends most of the sequence at anyway.
 * Deliberately identical in content to a VisualIndex tile, so the sequence and
 * the index read as the same object seen twice.
 */
const ProjectModule = forwardRef<HTMLDivElement, Props>(function ProjectModule(
  { project, state = "locked", className = "", style },
  ref
) {
  const active = state === "active";
  return (
    <div
      ref={ref}
      data-module={project.id}
      className={`group glass-smoked edge-lit relative w-[82vw] max-w-[460px] overflow-hidden rounded-[14px] transform-gpu transition-shadow duration-700 ${
        active ? project.glowClass : ""
      } ${className}`}
      style={style}
    >
      {/* active rim */}
      {active && (
        <div
          className="pointer-events-none absolute inset-0 z-20 rounded-[14px] opacity-70"
          style={{
            padding: "1px",
            background: `linear-gradient(140deg, rgba(${project.glow},0.7), rgba(${project.glow},0) 45%, rgba(255,255,255,0.18) 100%)`,
            WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
            WebkitMaskComposite: "xor",
            maskComposite: "exclude",
          }}
        />
      )}

      <div className="relative aspect-[16/10] overflow-hidden">
        <img
          src={project.shot}
          alt={project.shotAlt}
          className="absolute inset-0 h-full w-full object-cover object-top"
          loading="lazy"
          decoding="async"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent" />
      </div>

      {/* No name, no host. The card is pure image during the flight — the index
          below names each build, and repeating it here was the same redundancy
          the original site had (three links stated three times). */}
      <span
        aria-hidden="true"
        className={`absolute bottom-4 right-4 z-10 h-2 w-2 rounded-full ${active ? "anim-status" : ""}`}
        style={{
          background: `rgb(${project.glow})`,
          boxShadow: active ? `0 0 10px rgb(${project.glow})` : "none",
        }}
      />

      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-px"
        style={{
          background: `linear-gradient(90deg, transparent, rgba(${project.glow},0.7), transparent)`,
        }}
      />

      {/* sealed state during the sequence — no label, just a veil */}
      {!active && (
        <div
          className="pointer-events-none absolute inset-0 z-30 bg-bg/45 backdrop-blur-[1px]"
          aria-hidden="true"
        />
      )}
    </div>
  );
});

export default ProjectModule;
