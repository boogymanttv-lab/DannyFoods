export const metadata = { title: "Алергени" };

const ALLERGENS = [
  "Глутен (пшеница, ечемик и др.)",
  "Мляко и млечни продукти",
  "Яйца",
  "Соя",
  "Ядки",
  "Сусам",
  "Синап",
  "Целина",
];

export default function AllergensPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 space-y-6">
      <h1 className="font-display font-extrabold text-3xl">Алергени</h1>
      <p className="text-foreground/80 leading-relaxed">
        Част от продуктите ни съдържат или могат да съдържат следните алергени.
        Храната се приготвя в кухня, в която се обработват различни съставки, и не
        можем да гарантираме пълна липса на кръстосано замърсяване.
      </p>

      <div className="flex flex-wrap gap-2">
        {ALLERGENS.map((a) => (
          <span
            key={a}
            className="bg-gold/15 text-accent-dark text-sm font-semibold px-3 py-1.5 rounded-full"
          >
            {a}
          </span>
        ))}
      </div>

      <p className="text-foreground/80 leading-relaxed">
        Ако имате хранителна алергия или непоносимост, моля свържете се с нас по
        телефона преди да поръчате, за да ви уточним точния състав на продукта.
      </p>
    </div>
  );
}
