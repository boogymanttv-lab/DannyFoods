import { getSettings } from "@/lib/repos/settings";
import { listCategories } from "@/lib/repos/categories";
import { SettingsManager } from "@/components/admin/SettingsManager";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const settings = await getSettings();
  const categories = await listCategories(false);
  return <SettingsManager initialSettings={settings} categories={categories} />;
}
