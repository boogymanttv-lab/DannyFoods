// A thin bar pinned above the header — admin-editable in Настройки ("Промо
// лента"), including whether it scrolls or sits still ("Вид на лентата").
// Empty text hides the whole bar instead of showing a blank strip.
export function PromoBanner({
  text,
  mode = "scroll",
}: {
  text: string;
  mode?: "scroll" | "static";
}) {
  if (!text.trim()) return null;

  if (mode === "static") {
    return (
      <div className="relative bg-gradient-to-r from-gold via-[#ffc247] to-gold text-accent-dark shadow-[0_2px_12px_rgba(245,166,35,0.35)]">
        <p className="py-2 px-4 text-center text-xs sm:text-sm font-extrabold tracking-wide">
          {text}
        </p>
      </div>
    );
  }

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
