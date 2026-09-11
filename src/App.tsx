import { useRef } from "react";
import Navbar from "./components/Navbar";
import HeroMachine from "./components/HeroMachine";
import ScrollMachine from "./components/ScrollMachine";
import GitHubProfile from "./components/GitHubProfile";
import VisualIndex from "./components/VisualIndex";
import SiteFooter from "./components/SiteFooter";
import ConstellationField from "./components/ConstellationField";

/**
 * Order changed 11 Sep 2026: GitHub now comes BEFORE the site previews.
 *
 * The code leads. The three websites are supporting evidence underneath it,
 * which is why their tiles also got smaller — they read as a gallery strip now
 * rather than as the main event.
 */
export default function App() {
  const progressRef = useRef(0);

  return (
    <div className="relative min-h-screen bg-bg text-text-primary font-body overflow-x-hidden">
      <ConstellationField progressRef={progressRef} />

      <Navbar />
      <main className="relative z-10">
        <HeroMachine isReady />
        {/* desktop-only cinematic sequence; returns null on phones */}
        <ScrollMachine progressRef={progressRef} />
        <GitHubProfile />
        <VisualIndex />
      </main>
      <SiteFooter />
    </div>
  );
}
