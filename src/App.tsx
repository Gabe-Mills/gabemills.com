import Navbar from "./components/Navbar";
import BuildRoot from "./build/BuildRoot";
import Hero from "./build/sections/Hero";
import Work from "./build/sections/Work";
import Numbers from "./build/sections/Numbers";
import Stack from "./build/sections/Stack";
import Contact from "./build/sections/Contact";

/**
 * v6 "simplify" (17 Nov 2026): the page builds itself, but only the hero. A named crew of
 * four cursors builds it on load (src/build/engine.ts); everything below simply rises in.
 * Five sections: hero, work, numbers, stack, contact (with the 3D GM). The reel and the GitHub
 * repo cards were cut; the engraved story lives on branch intro-engraved.
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
          <Stack />
          <Contact />
        </BuildRoot>
      </main>
    </div>
  );
}
