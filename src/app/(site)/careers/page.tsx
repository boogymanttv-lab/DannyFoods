import { getSettings } from "@/lib/repos/settings";

export const dynamic = "force-dynamic";

export const metadata = { title: "Кандидатстване за работа" };

export default async function CareersPage() {
  const settings = await getSettings();
  const phoneHref = settings.phone.replace(/\s/g, "");

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 space-y-8">
      <div>
        <h1 className="font-display font-extrabold text-3xl mb-3">
          Кандидатствай за работа
        </h1>
        <p className="text-foreground/80 leading-relaxed">
          {settings.site_name} расте и винаги търсим позитивни хора за екипа си
          във Варна. Свържи се с нас по телефона или изпрати кратко съобщение с
          твоите данни — ще се свържем с теб.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="bg-surface rounded-2xl border border-border p-5">
          <h2 className="font-semibold mb-1">🛵 Куриер</h2>
          <p className="text-sm text-foreground/70">
            Собствено превозно средство (велосипед, мотопед или кола), познаване
            на кварталите на Варна, гъвкав график.
          </p>
        </div>
        <div className="bg-surface rounded-2xl border border-border p-5">
          <h2 className="font-semibold mb-1">👨‍🍳 Кухня</h2>
          <p className="text-sm text-foreground/70">
            Опит в приготвяне на пица/дюнери/бургери е предимство, но не е
            задължителен — обучаваме на място.
          </p>
        </div>
      </div>

      <div className="bg-accent-dark text-white rounded-2xl p-6">
        <h2 className="font-semibold mb-2">Как да кандидатстваш</h2>
        <p className="text-white/70 text-sm mb-3">
          Обади се директно или ни пиши на телефона по-долу — разкажи ни малко за
          себе си и на коя позиция кандидатстваш.
        </p>
        <a
          href={`tel:${phoneHref}`}
          className="inline-block bg-brand hover:bg-brand-light transition-colors font-bold px-5 py-3 rounded-xl"
        >
          📞 {settings.phone}
        </a>
      </div>
    </div>
  );
}
