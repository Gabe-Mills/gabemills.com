import Words from "../Words";
import { LoopVideo } from "./Work";
import "./reel.css";

/**
 * Reel, v3: the most dramatic moment on the page. Darkness above and below; the section pins
 * while a small, dim screen in the dark grows to full-bleed (full width at 16:9 on phones),
 * comes up to full brightness, and the two halves of the headline part, one to the top and one
 * to the bottom, while a slow light sweeps across the metallic type (CSS view timeline).
 * v4: each half is a kinetic Words line (the words rise out of their masks as the crew types);
 * the split-apart motion stays on the half wrappers, so the rise plays inside it.
 * public/build/reel.mp4 (+ .webm, reel.jpg poster) is cut from the four preview loops:
 * ~3 s of each, 6-frame dissolves, 12 s, seamless loop.
 */
export default function Reel() {
  return (
    <section id="reel" className="reel" aria-labelledby="reel-title">
      <div className="reel-track">
        <div className="reel-stage">
          <div className="reel-glow" aria-hidden="true" />
          <div className="reel-grow">
            <div className="reel-media" data-build="media" data-delay="0.02" data-label="reel.mp4 · 1920 × 1080">
              <LoopVideo
                src="/build/reel.mp4"
                poster="/build/reel.jpg"
                label="A twelve-second montage of Prism SMP, Leland Plays Piano, Ricochet Tanks and Gcoolers, each site scrolling"
              />
            </div>
            <span className="reel-spill" aria-hidden="true" />
          </div>
          <div className="reel-shade" aria-hidden="true" />
          <h2 id="reel-title" className="bp-display reel-title" aria-label="From idea. To shipped.">
            <span className="reel-half reel-half--a">
              <Words text="From idea." delay={0.04} className="reel-line" />
            </span>
            <span className="reel-half reel-half--b">
              {/* Words stars single words only, so each accent word is starred on its own */}
              <Words text="*To* *shipped.*" delay={0.08} className="reel-line" />
            </span>
          </h2>
        </div>
      </div>
    </section>
  );
}
