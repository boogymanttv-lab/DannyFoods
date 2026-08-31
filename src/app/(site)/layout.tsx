import { getSettings } from "@/lib/repos/settings";
import { getCustomerSession } from "@/lib/auth";
import { getLocale } from "@/lib/i18n/locale";
import { LocaleProvider } from "@/lib/i18n/LocaleProvider";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { CartDrawer } from "@/components/site/CartDrawer";
import { MobileCartBar } from "@/components/site/MobileCartBar";
import { SplashScreen } from "@/components/site/SplashScreen";
import { CookieConsent } from "@/components/site/CookieConsent";
import { PromoBanner } from "@/components/site/PromoBanner";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettings();
  const session = await getCustomerSession();
  const locale = await getLocale();

  return (
    <LocaleProvider initialLocale={locale}>
      <SplashScreen siteName={settings.site_name} logoUrl={settings.logo_url}>
        <PromoBanner
          text={settings.banner_text}
          mode={settings.banner_scroll_mode === "static" ? "static" : "scroll"}
        />
        <Header
          siteName={settings.site_name}
          phone={settings.phone}
          logoUrl={settings.logo_url}
          loggedIn={Boolean(session)}
        />
        <main className="flex-1">{children}</main>
        <Footer
          siteName={settings.site_name}
          phone={settings.phone}
          address={settings.address}
          workingHours={settings.working_hours}
          facebookUrl={settings.facebook_url}
          instagramUrl={settings.instagram_url}
          companyLegalName={settings.company_legal_name}
          companyEik={settings.company_eik}
        />
        <CartDrawer />
        <MobileCartBar />
        <CookieConsent gaId={settings.ga_measurement_id} metaPixelId={settings.meta_pixel_id} />
      </SplashScreen>
    </LocaleProvider>
  );
}
