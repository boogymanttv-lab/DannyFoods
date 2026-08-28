import { getDb } from "@/lib/db";
import type { Category } from "@/lib/types";

export async function listCategories(activeOnly = true): Promise<Category[]> {
  const db = await getDb();
  const sql = activeOnly
    ? "SELECT * FROM categories WHERE active = 1 ORDER BY sort_order ASC, id ASC"
    : "SELECT * FROM categories ORDER BY sort_order ASC, id ASC";
  return db.prepare(sql).all() as Promise<Category[]>;
}

export async function getCategoryBySlug(slug: string): Promise<Category | undefined> {
  const db = await getDb();
  return db.prepare("SELECT * FROM categories WHERE slug = ?").get(slug) as Promise<
    Category | undefined
  >;
}

export async function createCategory(data: {
  slug: string;
  name: string;
  icon?: string;
  sort_order?: number;
}) {
  const db = await getDb();
  const info = await db
    .prepare(
      "INSERT INTO categories (slug, name, icon, sort_order) VALUES (@slug, @name, @icon, @sort_order)"
    )
    .run({
      slug: data.slug,
      name: data.name,
      icon: data.icon ?? "",
      sort_order: data.sort_order ?? 0,
    });
  return info.lastInsertRowid as number;
}

export async function updateCategory(
  id: number,
  data: Partial<Pick<Category, "name" | "icon" | "sort_order" | "active" | "slug">>
) {
  const db = await getDb();
  const fields = Object.keys(data);
  if (fields.length === 0) return;
  const setClause = fields.map((f) => `${f} = @${f}`).join(", ");
  await db.prepare(`UPDATE categories SET ${setClause} WHERE id = @id`).run({
    ...data,
    id,
  });
}

export async function deleteCategory(id: number) {
  const db = await getDb();
  await db.prepare("DELETE FROM categories WHERE id = ?").run(id);
}
