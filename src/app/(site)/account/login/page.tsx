import Link from "next/link";
import { getSettings } from "@/lib/repos/settings";
import { AccountLoginForm } from "@/components/site/AccountLoginForm";
import { GoogleButton } from "@/components/site/GoogleButton";
import { getLocale } from "@/lib/i18n/locale";
import { translate, type DictKey } from "@/lib/i18n/dict";
import { localizeTree } from "@/lib/i18n/tree";
import { localizedTitle } from "@/lib/i18n/meta";

export const dynamic = "force-dynamic";

const ERROR_KEYS: Record<string, DictKey> = {
  google_not_configured: "auth.error.google_not_configured",
  google_failed: "auth.error.google_failed",
  google_email: "auth.error.google_email",
};

export async function generateMetadata() {
  return localizedTitle("Вход в профила");
}

export default async function AccountLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; redirect?: string }>;
}) {
  const settings = await getSettings();
  const { error, redirect } = await searchParams;
  const redirectTo = redirect && redirect.startsWith("/") ? redirect : "/account";
  const locale = await getLocale();
  const errorKey = error ? ERROR_KEYS[error] : undefined;
  const errorMessage = errorKey ? translate(locale, errorKey) : null;

  return localizeTree(
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
    </div>,
    locale
  );
}
