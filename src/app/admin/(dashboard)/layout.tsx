import { getSession } from "@/lib/auth";
import { AdminShell } from "@/components/admin/AdminShell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  return (
    <AdminShell adminName={session?.name ?? "Admin"} role={session?.role ?? "owner"}>
      {children}
    </AdminShell>
  );
}
