// A thin scrolling ticker pinned above the header — admin-editable in
// Настройки ("Промо лента"). Empty text hides the whole bar instead of
// showing a blank strip.
export function PromoBanner({ text }: { text: string }) {
  if (!text.trim()) return null;

  return (
    <div className="bg-gold text-accent-dark overflow-hidden whitespace-nowrap">
      <div className="flex animate-marquee py-2 text-xs sm:text-sm font-bold">
        <span className="px-4">{text}</span>
        <span className="px-4" aria-hidden>
          {text}
        </span>
      </div>
    </div>
  );
}
