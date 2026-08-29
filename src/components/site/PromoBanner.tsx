// A thin scrolling ticker pinned above the header — admin-editable in
// Настройки ("Промо лента"). Empty text hides the whole bar instead of
// showing a blank strip.
export function PromoBanner({ text }: { text: string }) {
  if (!text.trim()) return null;

  return (
    <div className="relative bg-gradient-to-r from-gold via-[#ffc247] to-gold text-accent-dark overflow-hidden whitespace-nowrap shadow-[0_2px_12px_rgba(245,166,35,0.35)]">
      <div className="flex animate-marquee py-2 text-xs sm:text-sm font-extrabold tracking-wide">
        <span className="px-4">{text}</span>
        <span className="px-4" aria-hidden>
          {text}
        </span>
      </div>
    </div>
  );
}
