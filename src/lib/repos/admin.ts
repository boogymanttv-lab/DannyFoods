import { getDb } from "@/lib/db";

export type AdminUser = {
  id: number;
  email: string;
  password_hash: string;
  name: string;
  created_at: string;
};

export async function getAdminByEmail(email: string): Promise<AdminUser | undefined> {
  const db = await getDb();
  return db.prepare("SELECT * FROM admin_users WHERE LOWER(email) = LOWER(?)").get(
    email.trim()
  ) as Promise<AdminUser | undefined>;
}

export async function createAdmin(data: { email: string; password_hash: string; name?: string }) {
  const db = await getDb();
  const info = await db
    .prepare(
      "INSERT INTO admin_users (email, password_hash, name) VALUES (@email, @password_hash, @name)"
    )
    .run({
      email: data.email.trim().toLowerCase(),
      password_hash: data.password_hash,
      name: data.name ?? "Admin",
    });
  return info.lastInsertRowid as number;
}

export async function countAdmins(): Promise<number> {
  const db = await getDb();
  const row = (await db.prepare("SELECT COUNT(*) as cnt FROM admin_users").get()) as {
    cnt: number;
  };
  return Number(row.cnt);
}

export async function updateAdminPassword(id: number, password_hash: string) {
  const db = await getDb();
  await db.prepare("UPDATE admin_users SET password_hash = ? WHERE id = ?").run(password_hash, id);
}
