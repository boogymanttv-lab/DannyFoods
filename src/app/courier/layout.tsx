import type { Metadata } from "next";

// Applies to every courier page (login included), so the panel can be
// added to the phone's home screen as an app — needed for notifications
// on iPhone.
export const metadata: Metadata = {
  manifest: "/courier.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Куриер",
    statusBarStyle: "default",
  },
  robots: { index: false, follow: false },
};

export default function CourierRootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
