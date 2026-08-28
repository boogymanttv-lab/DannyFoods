import Link from "next/link";
import { getSettings } from "@/lib/repos/settings";
import { AccountRegisterForm } from "@/components/site/AccountRegisterForm";
import { GoogleButton } from "@/components/site/GoogleButton";

export const dynamic = "force-dynamic";

export default async function AccountRegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const settings = await getSettings();
  const { redirect } = await searchParams;
  const redirectTo = redirect && redirect.startsWith("/") ? redirect : "/account";

  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <div className="text-center mb-6">
        <h1 className="font-display font-extrabold text-2xl">Създай профил</h1>
        <p className="text-sm text-muted mt-1">
          Отнема по-малко от минута — следващия път поръчваш с два клика.
        </p>
      </div>

      <div className="bg-surface rounded-2xl border border-border p-6 space-y-4">
        {settings.google_client_id && <GoogleButton redirectTo={redirectTo} />}

        {settings.google_client_id && (
          <div className="flex items-center gap-3 text-xs text-muted">
            <div className="flex-1 h-px bg-border" />
            или с имейл
            <div className="flex-1 h-px bg-border" />
          </div>
        )}

        <AccountRegisterForm redirectTo={redirectTo} />

        <p className="text-center text-sm text-muted">
          Вече имаш профил?{" "}
          <Link href={`/account/login?redirect=${encodeURIComponent(redirectTo)}`} className="text-brand font-semibold">
            Влез
          </Link>
        </p>
      </div>
    </div>
  );
}
