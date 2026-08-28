import { listZones } from "@/lib/repos/zones";
import { ZonesManager } from "@/components/admin/ZonesManager";

export const dynamic = "force-dynamic";

export default async function AdminZonesPage() {
  const zones = await listZones(false);
  return <ZonesManager initialZones={zones} />;
}
