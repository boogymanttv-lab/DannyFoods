import Link from "next/link";

const HELP_LINKS = [
  { label: "Свържете се с нас", href: "/contact" },
  { label: "Условия за ползване", href: "/terms" },
];

const INFO_LINKS = [
  { label: "Оферти", href: "/oferti" },
  { label: "Зони за доставка", href: "/zones" },
  { label: "Алергени", href: "/allergens" },
  { label: "Политика за защита на личните данни", href: "/privacy" },
];

const ABOUT_LINKS = [{ label: "Кандидатстване за работа", href: "/careers" }];

export function Footer({
  siteName,
  phone,
  address,
  workingHours,
  facebookUrl,
  instagramUrl,
  companyLegalName,
  companyEik,
}: {
  siteName: string;
  phone: string;
  address: string;
  workingHours: string;
  facebookUrl?: string;
  instagramUrl?: string;
  companyLegalName?: string;
  companyEik?: string;
}) {
  const hasSocial = Boolean(facebookUrl || instagramUrl);

  return (
    <footer className="mt-16 bg-accent-dark text-white/90 pb-24 md:pb-8">
      <div className="mx-auto max-w-6xl px-4 pt-10">
        <h3 className="font-display font-extrabold text-lg text-white">{siteName}</h3>
        <p className="text-sm text-white/60 mt-1 max-w-md">
          Пица, дюнери, бургери, сандвичи и джобове с доставка само в град Варна.
        </p>
        <p className="text-sm text-white/50 mt-1">
          📍 {address} &nbsp;·&nbsp; 🕒 {workingHours}
        </p>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-10 grid gap-8 sm:grid-cols-3 border-t border-white/10 mt-8">
        <FooterColumn title="Нека да помогнем" links={HELP_LINKS} />
        <FooterColumn title="Полезна информация" links={INFO_LINKS} />
        <FooterColumn title="Опознай ни" links={ABOUT_LINKS} />
      </div>

      <div className="border-t border-white/10 py-5">
        <div className="mx-auto max-w-6xl px-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
          <a
            href={`tel:${phone.replace(/\s/g, "")}`}
            className="flex items-center gap-1.5 font-bold text-white hover:text-brand-light transition-colors"
          >
            📞 {phone}
          </a>

          {hasSocial && (
            <div className="flex items-center gap-3">
              {facebookUrl && (
                <SocialIcon href={facebookUrl} label="Facebook">
                  <path d="M13.5 21v-7.5h2.5l.4-3H13.5V8.5c0-.87.24-1.46 1.49-1.46H16.5V4.35C16.2 4.31 15.19 4.22 14 4.22c-2.36 0-3.98 1.44-3.98 4.08V10.5H7.5v3H10V21h3.5z" />
                </SocialIcon>
              )}
              {instagramUrl && (
                <SocialIcon href={instagramUrl} label="Instagram">
                  <path d="M12 8.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6zm0 6.27a2.47 2.47 0 1 1 0-4.94 2.47 2.47 0 0 1 0 4.94zm4.85-6.42a.89.89 0 1 1-1.77 0 .89.89 0 0 1 1.77 0zM20 7.4a4.6 4.6 0 0 0-1.26-3.26A4.6 4.6 0 0 0 15.48 2.9C14.28 2.83 9.72 2.83 8.52 2.9A4.6 4.6 0 0 0 5.26 4.14 4.6 4.6 0 0 0 4 7.4c-.07 1.2-.07 5.76 0 6.96a4.6 4.6 0 0 0 1.26 3.26 4.6 4.6 0 0 0 3.26 1.24c1.2.07 5.76.07 6.96 0a4.6 4.6 0 0 0 3.26-1.24A4.6 4.6 0 0 0 20 14.36c.07-1.2.07-5.75 0-6.95zm-1.85 8.45a2.6 2.6 0 0 1-1.47 1.47c-1.02.4-3.43.31-4.68.31s-3.66.09-4.68-.31a2.6 2.6 0 0 1-1.47-1.47c-.4-1.02-.31-3.43-.31-4.68s-.09-3.66.31-4.68a2.6 2.6 0 0 1 1.47-1.47c1.02-.4 3.43-.31 4.68-.31s3.66-.09 4.68.31a2.6 2.6 0 0 1 1.47 1.47c.4 1.02.31 3.43.31 4.68s.09 3.66-.31 4.68z" />
                </SocialIcon>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-white/10 py-4 text-center text-xs text-white/40 space-y-0.5">
        <p>
          © {new Date().getFullYear()} {siteName}. Всички права запазени. Created by:{" "}
          <a
            href="https://cfxwebstudio.xyz"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-white/70 transition-colors"
          >
            cfxwebstudio
          </a>
        </p>
        {(companyLegalName || companyEik) && (
          <p>
            {companyLegalName}
            {companyEik && <> · ЕИК {companyEik}</>}
          </p>
        )}
      </div>

      <div className="border-t border-white/10 py-4">
        <div className="mx-auto max-w-6xl px-4 flex flex-wrap items-center justify-center gap-2">
          <VisaBadge />
          <MastercardBadge />
          <StripeBadge />
        </div>
      </div>
    </footer>
  );
}

function PaymentBadge({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <span
      role="img"
      aria-label={label}
      className="flex h-7 w-12 items-center justify-center rounded-md bg-white px-1.5"
    >
      {children}
    </span>
  );
}

function VisaBadge() {
  return (
    <PaymentBadge label="Visa">
      <svg viewBox="0 0 48 16" className="h-3.5 w-auto">
        <text
          x="24"
          y="13"
          textAnchor="middle"
          fontFamily="Georgia, 'Times New Roman', serif"
          fontStyle="italic"
          fontWeight="bold"
          fontSize="15"
          fill="#1434CB"
        >
          VISA
        </text>
      </svg>
    </PaymentBadge>
  );
}

function MastercardBadge() {
  return (
    <PaymentBadge label="Mastercard">
      <svg viewBox="0 0 32 20" className="h-5 w-auto">
        <circle cx="12" cy="10" r="8" fill="#EB001B" />
        <circle cx="20" cy="10" r="8" fill="#F79E1B" />
        <path
          d="M16 3.8a8 8 0 0 1 0 12.4 8 8 0 0 1 0-12.4z"
          fill="#FF5F00"
        />
      </svg>
    </PaymentBadge>
  );
}

function StripeBadge() {
  return (
    <PaymentBadge label="Stripe">
      <svg viewBox="0 0 60 16" className="h-3 w-auto">
        <text
          x="30"
          y="13"
          textAnchor="middle"
          fontFamily="Arial, Helvetica, sans-serif"
          fontWeight="700"
          fontSize="14"
          fill="#635BFF"
        >
          stripe
        </text>
      </svg>
    </PaymentBadge>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: { label: string; href: string }[];
}) {
  return (
    <div>
      <h4 className="font-bold text-xs tracking-wide text-white/90 uppercase mb-3">
        {title}
      </h4>
      <ul className="space-y-2">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="text-sm text-white/60 hover:text-white transition-colors">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SocialIcon({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="h-9 w-9 rounded-full border border-white/20 grid place-items-center hover:bg-brand hover:border-brand transition-colors"
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-white">
        {children}
      </svg>
    </a>
  );
}
