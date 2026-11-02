import Navbar from "./components/Navbar";
import EngravedIntro from "./components/EngravedIntro";
import Showcase from "./showcase/Showcase";

/**
 * Branch intro-engraved: the new portfolio.
 *
 * An engraved scroll intro (src/intro), then the showcase (src/showcase): the same
 * content the original site carries (hero line, the three projects, GitHub, stack,
 * footer) drawn as comic pages in the intro's palette. The original sections
 * (HeroMachine, ScrollMachine, GitHubProfile, StackSection, VisualIndex, SiteFooter,
 * ConstellationField) are untouched in src/components and still render on main.
 */
export default function App() {
  return (
    <div className="relative min-h-screen bg-bg text-text-primary font-body overflow-x-clip">
      <Navbar />
      <main className="relative z-10">
        <EngravedIntro />
        <Showcase />
      </main>
    </div>
  );
}
