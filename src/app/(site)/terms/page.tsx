import { getSettings } from "@/lib/repos/settings";

export const dynamic = "force-dynamic";

export const metadata = { title: "Условия за ползване" };

export default async function TermsPage() {
  const settings = await getSettings();
  const legalName = settings.company_legal_name || settings.site_name;
  const email = settings.contact_email;

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="font-display font-extrabold text-3xl mb-2">Общи условия за ползване</h1>
      <p className="text-sm text-muted mb-6">Последна актуализация: 28.08.2026 г.</p>

      <div className="space-y-5 text-foreground/80 leading-relaxed">
        <Section title="1. Търговец и данни за контакт">
          <p>
            Настоящите общи условия уреждат ползването на уебсайта {settings.site_name}
            {settings.site_domain && <> ({settings.site_domain})</>} и онлайн поръчването на храна
            с доставка (или вземане лично) в град Варна, стопанисван от{" "}
            <strong className="text-foreground">{legalName}</strong>
            {settings.company_eik && <>, ЕИК {settings.company_eik}</>}
            {settings.company_vat && <>, регистрирана по ЗДДС с номер {settings.company_vat}</>}
            {settings.company_registered_address && (
              <>, седалище и адрес на управление: {settings.company_registered_address}</>
            )}
            . С изпращането на поръчка потвърждавате, че сте се запознали и приемате тези условия.
          </p>
          <p className="mt-2">
            Адрес за кореспонденция и вземане на поръчки лично: {settings.address}. Телефон:{" "}
            <a href={`tel:${settings.phone.replace(/\s/g, "")}`} className="text-brand font-semibold">
              {settings.phone}
            </a>
            {email && (
              <>
                {" "}
                · Имейл:{" "}
                <a href={`mailto:${email}`} className="text-brand font-semibold">
                  {email}
                </a>
              </>
            )}
            .
          </p>
        </Section>

        <Section title="2. Поръчки">
          Поръчка се смята за приета от момента на потвърждение на страницата
          &quot;Проследяване&quot;. Пресните продукти се приготвят след потвърждение на поръчката —
          възможни са разумни отклонения от посоченото време за доставка при натоварване или лоши
          метеорологични условия. Приемаме поръчки само в рамките на посоченото работно време.
        </Section>

        <Section title="3. Цени и плащане">
          Всички цени на сайта са в евро (€) с включен ДДС, където е приложимо. Приемаме плащане в
          брой на куриера, с карта на куриера (ПОС) или онлайн с карта при поръчката, ако тази
          опция е активна. Дължимата сума се показва изцяло преди потвърждаване на поръчката —
          междинна сума, такса за доставка и евентуална отстъпка.
        </Section>

        <Section title="4. Минимална поръчка, такса и зона на доставка">
          За всяка зона на доставка в град Варна важи индивидуална минимална сума на поръчката и
          такса за доставка — те се показват преди финализиране на поръчката. Обслужваме само
          адреси в град Варна; извън тях поръчка не може да бъде завършена.
        </Section>

        <Section title="5. Отказ от поръчка и право на връщане">
          <p>
            Поръчка може да бъде отказана по телефона, докато все още не е предадена за
            приготвяне. Съгласно чл. 57, т. 4 от Закона за защита на потребителите, правото на
            отказ по чл. 50 ЗЗП (14-дневен срок за връщане при онлайн покупки) не се прилага за
            договори за доставка на храни, които поради своето естество могат да се влошат или
            изтекат бързо — след като приготвянето на поръчката е започнало, тя не подлежи на
            връщане или замяна поради характера на продукта.
          </p>
          <p className="mt-2">
            При проблем с получена поръчка (грешен, липсващ или некачествен продукт), моля,
            свържете се с нас възможно най-скоро на посочения телефон или имейл — ще потърсим
            подходящо решение (замяна, кредитна бележка или възстановяване на сума), както изисква
            Законът за защита на потребителите.
          </p>
        </Section>

        <Section title="6. Промоционални кодове">
          Промоционалните кодове важат при условията, посочени за всеки от тях (минимална сума на
          поръчката, период на валидност, лимит на ползване) и не могат да се комбинират помежду
          си, освен ако изрично не е посочено друго.
        </Section>

        <Section title="7. Отговорност">
          {legalName} полага грижа поръчките да бъдат приготвени и доставени коректно и в срок.
          При проблем с получена поръчка, моля свържете се с нас възможно най-скоро на посочения
          телефон или имейл. Отговорността ни за забавяне или дефект в услугата се ограничава до
          стойността на съответната поръчка, освен в случаите на умисъл или груба небрежност.
        </Section>

        <Section title="8. Извънсъдебно решаване на спорове">
          <p>
            Ако имате оплакване, което не сме успели да разрешим директно с вас, можете да
            използвате платформата на Европейската комисия за онлайн решаване на спорове (ОРС):{" "}
            <a
              href="https://ec.europa.eu/consumers/odr/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand font-semibold"
            >
              ec.europa.eu/consumers/odr
            </a>
            , както и Комисията за защита на потребителите (КЗП) —{" "}
            <a
              href="https://www.kzp.bg"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand font-semibold"
            >
              www.kzp.bg
            </a>
            .
          </p>
        </Section>

        <Section title="9. Приложимо право">
          Настоящите условия се уреждат от българското законодателство. Всеки спор, който не може
          да бъде разрешен по взаимно съгласие, е подсъден на компетентния български съд.
        </Section>

        <p className="text-sm text-muted pt-4 border-t border-border">
          За информация как обработваме личните ви данни вижте{" "}
          <a href="/privacy" className="text-brand font-semibold">
            Политиката за защита на личните данни
          </a>
          .
        </p>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="font-display font-bold text-lg text-foreground mb-1">{title}</h2>
      <div>{children}</div>
    </div>
  );
}
