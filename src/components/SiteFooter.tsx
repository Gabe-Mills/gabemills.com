/**
 * Near-wordless footer: a status dot and the wordmark. The email address and
 * the list of build hosts were removed 11 Sep 2026 on request — GitHub is the
 * only outbound personal link now.
 */
export default function SiteFooter() {
  return (
    <footer className="relative z-10 border-t border-white/8 px-5 py-10">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4">
        <span className="font-mono text-[12px] font-semibold tracking-tight text-text-primary">
          Gabe Mills
        </span>
        <div className="flex items-center gap-2.5">
          <span className="anim-status h-1.5 w-1.5 rounded-full bg-[#FFB15E]" />
          <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted">
            Online
          </span>
        </div>
      </div>
    </footer>
  );
}
