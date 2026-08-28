import { getSettings } from "@/lib/repos/settings";

export const dynamic = "force-dynamic";

export const metadata = { title: "Политика за защита на личните данни" };

export default async function PrivacyPage() {
  const settings = await getSettings();
  const legalName = settings.company_legal_name || settings.site_name;
  const email = settings.contact_email;

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="font-display font-extrabold text-3xl mb-2">
        Политика за защита на личните данни
      </h1>
      <p className="text-sm text-muted mb-6">Последна актуализация: 28.08.2026 г.</p>

      <div className="space-y-5 text-foreground/80 leading-relaxed">
        <Section title="1. Кой обработва вашите данни (администратор)">
          <p>
            Администратор на лични данни е <strong className="text-foreground">{legalName}</strong>
            {settings.company_eik && <>, ЕИК {settings.company_eik}</>}
            {settings.company_vat && <>, ДДС номер {settings.company_vat}</>}
            {settings.company_registered_address && (
              <>, със седалище и адрес на управление: {settings.company_registered_address}</>
            )}
            {" "}(наричано по-долу &quot;ние&quot;), чрез уебсайта {settings.site_name}.
          </p>
          {email && (
            <p className="mt-2">
              За въпроси относно вашите лични данни можете да се свържете с нас на имейл{" "}
              <a href={`mailto:${email}`} className="text-brand font-semibold">
                {email}
              </a>{" "}
              или на телефон{" "}
              <a href={`tel:${settings.phone.replace(/\s/g, "")}`} className="text-brand font-semibold">
                {settings.phone}
              </a>
              .
            </p>
          )}
        </Section>

        <Section title="2. Какви данни събираме">
          <p>В зависимост от това как използвате сайта, обработваме следните категории данни:</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>
              <strong className="text-foreground">При поръчка:</strong> име (по избор), телефон, адрес
              за доставка (квартал, улица, номер, а по желание — етаж/апартамент и звънец),
              съдържание на поръчката, метод на плащане и, ако създадете акаунт, имейл адрес.
            </li>
            <li>
              <strong className="text-foreground">При регистрация на акаунт:</strong> имейл, парола
              (съхранявана само като хеш — никога в четим вид), запазени адреси за бъдещи поръчки.
            </li>
            <li>
              <strong className="text-foreground">При плащане с карта онлайн:</strong> данните на
              картата се въвеждат и обработват директно от доставчика на платежни услуги (Stripe) —
              ние не виждаме и не съхраняваме пълния номер на картата на нашите сървъри.
            </li>
            <li>
              <strong className="text-foreground">Техническа информация:</strong> приблизителни
              координати на адреса за доставка (за картата за проследяване на куриера), IP адрес и
              данни от журнала на сървъра, използвани единствено за сигурност и отстраняване на
              технически проблеми.
            </li>
          </ul>
        </Section>

        <Section title="3. На какво правно основание и за какви цели">
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong className="text-foreground">Изпълнение на договор</strong> (чл. 6, §1, б.
              &quot;б&quot; от ОРЗД/GDPR) — за да приемем, приготвим, доставим и таксуваме поръчката
              ви, и да ви свържем с куриера при нужда.
            </li>
            <li>
              <strong className="text-foreground">Законово задължение</strong> (чл. 6, §1, б.
              &quot;в&quot;) — счетоводни и данъчни задължения по Закона за счетоводството.
            </li>
            <li>
              <strong className="text-foreground">Съгласие</strong> (чл. 6, §1, б. &quot;а&quot;) —
              единствено за незадължителни бисквитки за анализ на трафика (Google Analytics) и
              реклама (Meta/Facebook Pixel), ако и когато изрично сте се съгласили през банера за
              бисквитки. Виж раздел 6 по-долу.
            </li>
            <li>
              <strong className="text-foreground">Легитимен интерес</strong> (чл. 6, §1, б.
              &quot;е&quot;) — сигурност на сайта и предотвратяване на злоупотреби.
            </li>
          </ul>
          <p className="mt-2">
            Не използваме автоматизирано вземане на решения или профилиране по смисъла на чл. 22 от
            ОРЗД.
          </p>
        </Section>

        <Section title="4. С кого споделяме данни">
          <p>
            Не продаваме лични данни на трети страни. Споделяме само необходимия минимум с:
          </p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>назначения куриер — име, телефон и адрес за доставка, за да изпълни поръчката;</li>
            <li>
              Stripe (обработка на онлайн плащания с карта), ако изберете тази опция при плащане;
            </li>
            <li>
              доставчика на хостинг на сайта, единствено в качеството му на обработващ данните от
              наше име;
            </li>
            <li>
              компетентни държавни органи — само когато сме законово задължени да предоставим данни.
            </li>
          </ul>
        </Section>

        <Section title="5. Съхранение на данните">
          <ul className="list-disc pl-5 space-y-1">
            <li>Данни за поръчки и издадени документи — 10 години, съгласно Закона за счетоводството.</li>
            <li>
              Данни на регистриран акаунт — докато поддържате акаунта си активен, плюс разумен срок
              след последна активност, освен ако не поискате по-ранно изтриване (виж раздел 7).
            </li>
            <li>
              Съдържанието на количката за пазаруване се пази само локално във вашия браузър
              (localStorage), докато не завършите или изчистите поръчката — не се изпраща към нас,
              преди да натиснете &quot;Поръчай&quot;.
            </li>
          </ul>
        </Section>

        <Section title="6. Бисквитки (cookies)">
          <p>
            Сайтът използва два вида &quot;бисквитки&quot; и локално съхранение в браузъра:
          </p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>
              <strong className="text-foreground">Строго необходими</strong> — сесийна бисквитка за
              вход в акаунт/админ/куриер панел и локално съхранение на количката. Без тях сайтът не
              може да функционира и не изискват съгласие по закон.
            </li>
            <li>
              <strong className="text-foreground">По избор (само със съгласие)</strong> — Google
              Analytics (анализ на посещаемостта) и/или Meta/Facebook Pixel (реклама), ако са
              активирани. Зареждат се едва след като изрично натиснете &quot;Приемам&quot; в банера
              за бисквитки. Можете по всяко време да откажете или да оттеглите съгласието си, като
              изчистите бисквитките на браузъра си за този сайт.
            </li>
          </ul>
        </Section>

        <Section title="7. Вашите права">
          <p>По всяко време можете да поискате от нас, безплатно:</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>достъп до личните данни, които съхраняваме за вас;</li>
            <li>коригиране на неточни или непълни данни;</li>
            <li>изтриване на данните ви (&quot;право да бъдеш забравен&quot;), доколкото не сме законово задължени да ги пазим по-дълго;</li>
            <li>ограничаване на обработването или възражение срещу него;</li>
            <li>преносимост на данните в структуриран, машинночитаем формат.</li>
          </ul>
          {email && (
            <p className="mt-2">
              За да упражните тези права, пишете ни на{" "}
              <a href={`mailto:${email}`} className="text-brand font-semibold">
                {email}
              </a>
              . Ще отговорим в срок до 30 дни.
            </p>
          )}
          <p className="mt-2">
            Ако смятате, че обработваме данните ви незаконосъобразно, имате право да подадете жалба
            до Комисията за защита на личните данни (КЗЛД) — гр. София 1592, бул.
            &quot;Проф. Цветан Лазаров&quot; № 2,{" "}
            <a
              href="https://www.cpdp.bg"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand font-semibold"
            >
              www.cpdp.bg
            </a>
            .
          </p>
        </Section>

        <Section title="8. Сигурност">
          Прилагаме подходящи технически и организационни мерки за защита на данните ви —
          криптирана връзка (HTTPS), хеширане на пароли и ограничен достъп до данните само за
          персонала, на който му е нужен за изпълнение на поръчките.
        </Section>

        <p className="text-sm text-muted pt-4 border-t border-border">
          Този текст има информационен характер и е съобразен с дейността на онлайн доставка на
          храна. При съществена промяна в начина, по който обработваме данни, ще актуализираме тази
          страница.
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
