import { useLayoutEffect, useRef, useState, type MutableRefObject } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import ProjectModule from "./ProjectModule";
import { projects } from "../data/projects";
import { useReducedMotion, useIsMobile } from "../lib/hooks";

gsap.registerPlugin(ScrollTrigger);

interface Props {
  progressRef: MutableRefObject<number>;
}

/**
 * Pinned scroll driver. Writes shared progress (read by ConstellationField)
 * and choreographs the DOM project modules that float over the rendered core.
 */
export default function ScrollMachine({ progressRef }: Props) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<HTMLDivElement | null>(null);
  const modRefs = useRef<(HTMLDivElement | null)[]>([]);

  const [activeModule, setActiveModule] = useState(-1);
  const reduced = useReducedMotion();
  const isMobile = useIsMobile();

  const computeActive = (p: number) => {
    if (p >= 0.9) return 3;
    if (p >= 0.75) return 2;
    if (p >= 0.6) return 1;
    if (p >= 0.45) return 0;
    return -1;
  };

  useLayoutEffect(() => {
    if (isMobile) {
      // Mobile renders no pinned sequence (see the early return below), but the
      // WebGL core still reads progress — drive it from overall page scroll.
      const updateMobileProgress = () => {
        const doc = document.documentElement;
        const distance = Math.max(1, doc.scrollHeight - window.innerHeight);
        const p = Math.min(1, Math.max(0, window.scrollY / distance));
        progressRef.current = p;
        setActiveModule(computeActive(p));
      };

      updateMobileProgress();
      window.addEventListener("scroll", updateMobileProgress, { passive: true });
      window.addEventListener("resize", updateMobileProgress);
      return () => {
        window.removeEventListener("scroll", updateMobileProgress);
        window.removeEventListener("resize", updateMobileProgress);
      };
    }

    if (reduced) {
      progressRef.current = 1;
      setActiveModule(3);
      return;
    }

    const ctx = gsap.context(() => {
      const col = isMobile ? 0.0 : 0.34;
      const modules = modRefs.current.filter(Boolean) as HTMLDivElement[];
      const [m0, m1, m2] = modules;

      gsap.set(modules, {
        xPercent: -50,
        yPercent: -50,
        left: "50%",
        top: "52%",
        scale: 0.3,
        opacity: 0,
        filter: "blur(24px)",
        z: -200,
      });

      const tl = gsap.timeline({
        defaults: { ease: "power2.inOut" },
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top top",
          end: "bottom bottom",
          scrub: 0.9,
          pin: sceneRef.current,
          anticipatePin: 1,
          onUpdate: (self) => {
            const p = self.progress;
            progressRef.current = p;
            setActiveModule(computeActive(p));
          },
        },
      });

      // 15-30 boot: modules appear as silhouettes near the core
      tl.to(modules, { opacity: 0.3, scale: 0.5, filter: "blur(10px)", z: -120, duration: 14, stagger: 2 }, 16);

      // 30-45 open: separate outward
      tl.to(m0, { left: `${50 - col * 100}%`, scale: 0.72, opacity: 0.65, filter: "blur(4px)", z: 0, duration: 15 }, 30);
      tl.to(m1, { left: "50%", scale: 0.72, opacity: 0.65, filter: "blur(4px)", z: 0, duration: 15 }, 30);
      tl.to(m2, { left: `${50 + col * 100}%`, scale: 0.72, opacity: 0.65, filter: "blur(4px)", z: 0, duration: 15 }, 30);

      // 45-90 spotlight each in turn
      spotlight(tl, modules, 0, 45, col);
      spotlight(tl, modules, 1, 60, col);
      spotlight(tl, modules, 2, 75, col);

      // 90-100 align into a clean row
      const gap = isMobile ? 0 : 0.32;
      const fin = isMobile ? 0.6 : 0.82;
      tl.to(m0, { left: `${50 - gap * 100}%`, top: "52%", scale: fin, opacity: 1, filter: "blur(0px)", z: 0, duration: 10 }, 90);
      tl.to(m1, { left: "50%", top: "52%", scale: fin, opacity: 1, filter: "blur(0px)", z: 0, duration: 10 }, 90);
      tl.to(m2, { left: `${50 + gap * 100}%`, top: "52%", scale: fin, opacity: 1, filter: "blur(0px)", z: 0, duration: 10 }, 90);
    }, sectionRef);

    return () => ctx.revert();
  }, [reduced, isMobile, progressRef]);

  // On phones the pinned cinematic sequence doesn't work and only added scroll
  // for content the case studies below already carry properly. Skip it: the
  // WebGL core still animates from page scroll via the effect above.
  if (isMobile) return null;

  return (
    <div ref={sectionRef} className="relative min-h-[340vh]">
      <div
        ref={sceneRef}
        className="relative flex h-screen w-full items-center justify-center overflow-hidden"
        style={{ perspective: "1500px" }}
      >
        {/* DOM modules floating over the rendered core */}
        <div className="relative h-full w-full" style={{ transformStyle: "preserve-3d" }}>
          {projects.map((p, i) => {
            const isActive = activeModule === i || activeModule === 3;
            const isSpotlight = activeModule === i;
            return (
              <div
                key={p.id}
                ref={(el) => (modRefs.current[i] = el)}
                className="absolute"
                style={{ willChange: "transform, opacity, filter", transformStyle: "preserve-3d" }}
              >
                <div className="relative">
                  <ProjectModule
                    project={p}
                    state={isActive ? "active" : activeModule === -1 ? "idle" : "locked"}
                  />
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Open ${p.title} — ${p.host}`}
                    tabIndex={isActive ? 0 : -1}
                    aria-hidden={!isActive}
                    className={`absolute -bottom-12 left-1/2 flex h-10 w-10 -translate-x-1/2 items-center justify-center rounded-full border transition-all duration-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFB15E] ${
                      isSpotlight || activeModule === 3
                        ? "pointer-events-auto opacity-100 border-white/20 bg-black/50 text-text-primary backdrop-blur-xl hover:border-[rgba(255,177,94,0.6)]"
                        : "pointer-events-none opacity-0 border-transparent"
                    }`}
                    style={isSpotlight ? { boxShadow: `0 0 22px rgba(${p.glow},0.4)` } : undefined}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path
                        d="M7 17L17 7M17 7H9M17 7V15"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Bring module `idx` forward; push the others back into fog. */
function spotlight(tl: gsap.core.Timeline, modules: HTMLDivElement[], idx: number, at: number, col: number) {
  modules.forEach((m, i) => {
    if (i === idx) {
      tl.to(m, { left: "50%", top: "48%", scale: 1.08, opacity: 1, filter: "blur(0px)", z: 140, duration: 15 }, at);
    } else {
      const side = i < idx ? -1 : 1;
      tl.to(m, { left: `${50 + side * col * 100}%`, top: "53%", scale: 0.56, opacity: 0.28, filter: "blur(7px)", z: -150, duration: 15 }, at);
    }
  });
}
