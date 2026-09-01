import { getDb } from "@/lib/db";

export type AdminRole = "owner" | "staff";
export type AdminStation = "all" | "pizza" | "other";

export type AdminUser = {
  id: number;
  email: string;
  password_hash: string;
  name: string;
  role: AdminRole;
  station: AdminStation;
  created_at: string;
};

export type AdminUserPublic = Omit<AdminUser, "password_hash">;

export async function getAdminByEmail(email: string): Promise<AdminUser | undefined> {
  const db = await getDb();
  return db.prepare("SELECT * FROM admin_users WHERE LOWER(email) = LOWER(?)").get(
    email.trim()
  ) as Promise<AdminUser | undefined>;
}

export async function createAdmin(data: {
  email: string;
  password_hash: string;
  name?: string;
  role?: AdminRole;
  station?: AdminStation;
}) {
  const db = await getDb();
  const info = await db
    .prepare(
      `INSERT INTO admin_users (email, password_hash, name, role, station)
       VALUES (@email, @password_hash, @name, @role, @station)`
    )
    .run({
      email: data.email.trim().toLowerCase(),
      password_hash: data.password_hash,
      name: data.name ?? "Admin",
      role: data.role ?? "owner",
      station: data.station ?? "all",
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

// Employee accounts (role='staff') the owner has set up in Настройки →
// Служители — password_hash left out, this is only ever rendered in a list.
export async function listStaff(): Promise<AdminUserPublic[]> {
  const db = await getDb();
  const rows = (await db
    .prepare(
      "SELECT id, email, name, role, station, created_at FROM admin_users WHERE role = 'staff' ORDER BY id ASC"
    )
    .all()) as AdminUserPublic[];
  return rows;
}

// Scoped to role = 'staff' so this can never delete an owner account by
// accident (e.g. a stray/guessed id) — owners aren't managed from this UI.
export async function deleteStaff(id: number) {
  const db = await getDb();
  await db.prepare("DELETE FROM admin_users WHERE id = ? AND role = 'staff'").run(id);
}

// Same role='staff' guard as deleteStaff — an owner's own name/station
// can't be touched from this endpoint.
export async function updateStaff(
  id: number,
  data: Partial<{ name: string; station: AdminStation }>
) {
  const db = await getDb();
  const fields = Object.keys(data);
  if (fields.length === 0) return;
  const setClause = fields.map((f) => `${f} = @${f}`).join(", ");
  await db
    .prepare(`UPDATE admin_users SET ${setClause} WHERE id = @id AND role = 'staff'`)
    .run({ ...data, id });
}
