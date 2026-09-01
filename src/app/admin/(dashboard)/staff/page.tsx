import { listStaff } from "@/lib/repos/admin";
import { StaffManager } from "@/components/admin/StaffManager";

export const dynamic = "force-dynamic";

export default async function AdminStaffPage() {
  const staff = await listStaff();
  return <StaffManager initialStaff={staff} />;
}
