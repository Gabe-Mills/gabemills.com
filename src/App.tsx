import Navbar from "./components/Navbar";
import BuildRoot from "./build/BuildRoot";
import Hero from "./build/sections/Hero";
import Work from "./build/sections/Work";
import Numbers from "./build/sections/Numbers";
import Reel from "./build/sections/Reel";
import GitHub from "./build/sections/GitHub";
import Stack from "./build/sections/Stack";
import Contact from "./build/sections/Contact";

/**
 * Branch agent-build: the page builds itself as you scroll, assembled by a swarm of
 * cursors named after the AI tools Gabe actually works with (src/build). Every element
 * is driven by its own scroll position, so scrolling back up un-builds it.
 * The engraved story lives on branch intro-engraved; the original site's sections are
 * still in src/components.
 */
export default function App() {
  return (
    <div className="relative min-h-screen bg-[#050A07] text-text-primary font-body overflow-x-clip">
      <Navbar />
      <main className="relative z-10">
        <BuildRoot>
          <Hero />
          <Work />
          <Numbers />
          <Reel />
          <GitHub />
          <Stack />
          <Contact />
        </BuildRoot>
      </main>
    </div>
  );
}
