import { getCourierSession } from "@/lib/auth";
import { CourierShell } from "@/components/courier/CourierShell";

export default async function CourierDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getCourierSession();
  return <CourierShell courierName={session?.name ?? "Куриер"}>{children}</CourierShell>;
}
