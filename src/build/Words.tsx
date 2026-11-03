import { useLayoutEffect, useRef, type CSSProperties, type ElementType, type HTMLAttributes } from "react";

/**
 * Kinetic headline: each word rises out of its own masked line, one after another, as the
 * crew types (it is a data-build="text" element, so the engine drives --m 0..1 and the
 * caret/cursors work along it). *Starred* words or phrases ("*TO SHIPPED.*") are accents
 * and carry the metal sheen. "\n" breaks the line. Screen readers get the plain sentence
 * from a visually hidden copy (works on any element, unlike aria-label on a span).
 * Other props (id, data-*, aria-*) pass through to the element.
 *
 * Accent words share ONE gradient: each word's background is sized to its whole accent run
 * and shifted by its offset in the run (--gw/--gx, measured here), so the metal and its sheen
 * flow across "IN PUBLIC." without a seam at each word.
 *
 *   <Words as="h2" id="work-title" className="bp-display ..." text={"SELECTED *WORK.*"} />
 */
type Props = {
  text: string;
  as?: ElementType;
  className?: string;
  delay?: number;
  dur?: number;
  /** false renders the same words with no build (e.g. inside an element that already builds) */
  build?: boolean;
} & Omit<HTMLAttributes<HTMLElement>, "children">;

export default function Words({ text, as: Tag = "span", className = "", delay, dur, build = true, style, ...rest }: Props) {
  // accents may span several words: track whether we're inside *...* across the line
  const lines = text.split("\n").map((line) => {
    let inAccent = false;
    return line.split(/\s+/).filter(Boolean).map((raw) => {
      let w = raw;
      const opens = w.startsWith("*");
      if (opens) { inAccent = true; w = w.slice(1); }
      const closes = w.endsWith("*");
      if (closes) w = w.slice(0, -1);
      const accent = inAccent;
      if (closes) inAccent = false;
      return { w, accent };
    });
  });
  const plain = lines.map((l) => l.map((x) => x.w).join(" ")).join(" ");
  const ref = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const measure = () => {
      for (const line of Array.from(root.querySelectorAll<HTMLElement>(".bp-line"))) {
        const words = Array.from(line.querySelectorAll<HTMLElement>(".bp-w"));
        let run: HTMLElement[] = [];
        const flush = () => {
          if (!run.length) return;
          const x0 = run[0].offsetLeft, x1 = run[run.length - 1].offsetLeft + run[run.length - 1].offsetWidth;
          for (const w of run) {
            const inner = w.firstElementChild as HTMLElement;
            inner.style.setProperty("--gw", `${x1 - x0}px`);
            inner.style.setProperty("--gx", `${w.offsetLeft - x0}px`);
          }
          run = [];
        };
        for (const w of words) {
          if (w.firstElementChild?.classList.contains("bp-metal")) run.push(w);
          else flush();
        }
        flush();
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    document.fonts?.ready.then(measure);
    return () => ro.disconnect();
  }, [text]);
  const n = lines.reduce((s, l) => s + l.length, 0);
  let i = 0;
  return (
    <Tag
      {...rest}
      ref={ref}
      className={`bp-words ${className}`}
      style={{ ...style, "--n": n } as CSSProperties}
      {...(build ? { "data-build": "text" } : {})}
      {...(build && delay != null ? { "data-delay": delay } : {})}
      {...(build && dur != null ? { "data-dur": dur } : {})}
    >
      <span className="bp-sr">{plain}</span>
      {lines.map((line, li) => (
        <span key={li} className="bp-line" aria-hidden="true">
          {line.map(({ w, accent }, wi) => (
            <span key={wi} className="bp-w" style={{ "--i": i++ } as CSSProperties}>
              <span className={accent ? "bp-wi bp-metal" : "bp-wi"}>{w}</span>
              {wi < line.length - 1 ? " " : null}
            </span>
          ))}
        </span>
      ))}
    </Tag>
  );
}
