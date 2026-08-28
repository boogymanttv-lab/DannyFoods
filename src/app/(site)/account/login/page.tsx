import Link from "next/link";
import { getSettings } from "@/lib/repos/settings";
import { AccountLoginForm } from "@/components/site/AccountLoginForm";
import { GoogleButton } from "@/components/site/GoogleButton";

export const dynamic = "force-dynamic";

const ERROR_MESSAGES: Record<string, string> = {
  google_not_configured: "Вход с Google все още не е настроен за този сайт.",
  google_failed: "Възникна грешка при вход с Google. Опитайте отново.",
  google_email: "Google акаунтът трябва да има потвърден имейл.",
};

export default async function AccountLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; redirect?: string }>;
}) {
  const settings = await getSettings();
  const { error, redirect } = await searchParams;
  const redirectTo = redirect && redirect.startsWith("/") ? redirect : "/account";
  const errorMessage = error ? ERROR_MESSAGES[error] ?? null : null;

  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <div className="text-center mb-6">
        <h1 className="font-display font-extrabold text-2xl">Вход в профила</h1>
        <p className="text-sm text-muted mt-1">
          Виж историята на поръчките си и запази адресите си за по-бързо поръчване.
        </p>
      </div>

      <div className="bg-surface rounded-2xl border border-border p-6 space-y-4">
        {errorMessage && (
          <p className="text-sm text-brand font-semibold text-center">{errorMessage}</p>
        )}

        {settings.google_client_id && <GoogleButton redirectTo={redirectTo} />}

        {settings.google_client_id && (
          <div className="flex items-center gap-3 text-xs text-muted">
            <div className="flex-1 h-px bg-border" />
            или с имейл
            <div className="flex-1 h-px bg-border" />
          </div>
        )}

        <AccountLoginForm redirectTo={redirectTo} />

        <p className="text-center text-sm text-muted">
          Нямаш профил?{" "}
          <Link href={`/account/register?redirect=${encodeURIComponent(redirectTo)}`} className="text-brand font-semibold">
            Регистрирай се
          </Link>
        </p>
      </div>
    </div>
  );
}
