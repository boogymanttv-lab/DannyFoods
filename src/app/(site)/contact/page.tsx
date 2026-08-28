import { getSettings } from "@/lib/repos/settings";

export const dynamic = "force-dynamic";

export const metadata = { title: "Свържете се с нас" };

export default async function ContactPage() {
  const settings = await getSettings();

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 space-y-8">
      <h1 className="font-display font-extrabold text-3xl">Свържете се с нас</h1>
      <p className="text-muted">
        Имате въпрос за поръчка, доставка или искате да съобщите за проблем? Пишете ни
        или ни позвънете — с удоволствие ще помогнем.
      </p>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="bg-surface rounded-2xl border border-border p-5">
          <h2 className="font-semibold mb-1">📞 Телефон</h2>
          <a href={`tel:${settings.phone.replace(/\s/g, "")}`} className="text-brand font-bold">
            {settings.phone}
          </a>
        </div>
        {settings.contact_email && (
          <div className="bg-surface rounded-2xl border border-border p-5">
            <h2 className="font-semibold mb-1">✉️ Имейл</h2>
            <a href={`mailto:${settings.contact_email}`} className="text-brand font-bold">
              {settings.contact_email}
            </a>
          </div>
        )}
        <div className="bg-surface rounded-2xl border border-border p-5">
          <h2 className="font-semibold mb-1">📍 Адрес (и вземане лично)</h2>
          <p className="text-foreground/80">{settings.address}</p>
        </div>
        <div className="bg-surface rounded-2xl border border-border p-5">
          <h2 className="font-semibold mb-1">🕒 Работно време</h2>
          <p className="text-foreground/80">{settings.working_hours}</p>
        </div>
        <div className="bg-surface rounded-2xl border border-border p-5">
          <h2 className="font-semibold mb-1">🚴 Зона на доставка</h2>
          <p className="text-foreground/80">Обслужваме само град Варна.</p>
        </div>
      </div>

      {(settings.company_legal_name || settings.company_eik) && (
        <div className="text-xs text-muted border-t border-border pt-5">
          <p>
            {settings.company_legal_name}
            {settings.company_eik && <> · ЕИК {settings.company_eik}</>}
            {settings.company_vat && <> · ДДС № {settings.company_vat}</>}
          </p>
          {settings.company_registered_address && (
            <p className="mt-0.5">Седалище: {settings.company_registered_address}</p>
          )}
        </div>
      )}
    </div>
  );
}
