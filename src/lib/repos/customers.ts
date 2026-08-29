import { getDb } from "@/lib/db";
import type { Customer, CustomerPublic, CustomerAddress } from "@/lib/types";

function toPublic(c: Customer): CustomerPublic {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- destructured only to strip it from the returned object
  const { password_hash, ...rest } = c;
  return rest;
}

export async function getCustomer(id: number): Promise<Customer | undefined> {
  const db = await getDb();
  return db.prepare("SELECT * FROM customers WHERE id = ?").get(id) as Promise<
    Customer | undefined
  >;
}

export async function getCustomerPublic(id: number): Promise<CustomerPublic | undefined> {
  const c = await getCustomer(id);
  return c ? toPublic(c) : undefined;
}

export async function getCustomerByEmail(email: string): Promise<Customer | undefined> {
  const db = await getDb();
  return db
    .prepare("SELECT * FROM customers WHERE email = ?")
    .get(email.trim().toLowerCase()) as Promise<Customer | undefined>;
}

export async function getCustomerByGoogleId(googleId: string): Promise<Customer | undefined> {
  const db = await getDb();
  return db.prepare("SELECT * FROM customers WHERE google_id = ?").get(googleId) as Promise<
    Customer | undefined
  >;
}

export async function createCustomer(data: {
  name: string;
  email: string;
  phone?: string;
  password_hash?: string | null;
  google_id?: string | null;
  avatar_url?: string;
}): Promise<number> {
  const db = await getDb();
  const info = await db
    .prepare(
      `INSERT INTO customers (name, email, phone, password_hash, google_id, avatar_url)
       VALUES (@name, @email, @phone, @password_hash, @google_id, @avatar_url)`
    )
    .run({
      name: data.name,
      email: data.email.trim().toLowerCase(),
      phone: data.phone ?? "",
      password_hash: data.password_hash ?? null,
      google_id: data.google_id ?? null,
      avatar_url: data.avatar_url ?? "",
    });
  return info.lastInsertRowid as number;
}

export async function updateCustomer(
  id: number,
  data: Partial<{
    name: string;
    phone: string;
    password_hash: string | null;
    google_id: string | null;
    avatar_url: string;
  }>
) {
  const db = await getDb();
  const fields = Object.keys(data);
  if (fields.length === 0) return;
  const payload: Record<string, unknown> = { ...data, id };
  const setClause = fields.map((f) => `${f} = @${f}`).join(", ");
  await db.prepare(`UPDATE customers SET ${setClause} WHERE id = @id`).run(payload);
}

// ---------- Saved addresses ----------

export async function listAddresses(customerId: number): Promise<CustomerAddress[]> {
  const db = await getDb();
  return db
    .prepare(
      "SELECT * FROM customer_addresses WHERE customer_id = ? ORDER BY is_default DESC, id DESC"
    )
    .all(customerId) as Promise<CustomerAddress[]>;
}

export async function getAddress(id: number): Promise<CustomerAddress | undefined> {
  const db = await getDb();
  return db.prepare("SELECT * FROM customer_addresses WHERE id = ?").get(id) as Promise<
    CustomerAddress | undefined
  >;
}

export async function createAddress(data: {
  customer_id: number;
  label: string;
  zone_id: number | null;
  quarter?: string;
  address: string;
  street?: string;
  house_number?: string;
  intercom?: string;
  address_notes?: string;
  is_default?: boolean;
}): Promise<number> {
  const db = await getDb();
  if (data.is_default) {
    await db.prepare("UPDATE customer_addresses SET is_default = 0 WHERE customer_id = ?").run(
      data.customer_id
    );
  }
  const info = await db
    .prepare(
      `INSERT INTO customer_addresses (customer_id, label, zone_id, quarter, address, street, house_number, intercom, address_notes, is_default)
       VALUES (@customer_id, @label, @zone_id, @quarter, @address, @street, @house_number, @intercom, @address_notes, @is_default)`
    )
    .run({
      customer_id: data.customer_id,
      label: data.label,
      zone_id: data.zone_id,
      quarter: data.quarter ?? "",
      address: data.address,
      street: data.street ?? "",
      house_number: data.house_number ?? "",
      intercom: data.intercom ?? "",
      address_notes: data.address_notes ?? "",
      is_default: data.is_default ? 1 : 0,
    });
  return info.lastInsertRowid as number;
}

export async function updateAddress(
  id: number,
  customerId: number,
  data: Partial<{
    label: string;
    zone_id: number | null;
    quarter: string;
    address: string;
    street: string;
    house_number: string;
    intercom: string;
    address_notes: string;
    is_default: boolean;
  }>
) {
  const db = await getDb();
  if (data.is_default) {
    await db.prepare("UPDATE customer_addresses SET is_default = 0 WHERE customer_id = ?").run(
      customerId
    );
  }
  const fields = Object.keys(data);
  if (fields.length === 0) return;
  const payload: Record<string, unknown> = { ...data, id, customerId };
  if ("is_default" in data) payload.is_default = data.is_default ? 1 : 0;
  const setClause = fields.map((f) => `${f} = @${f}`).join(", ");
  await db
    .prepare(
      `UPDATE customer_addresses SET ${setClause} WHERE id = @id AND customer_id = @customerId`
    )
    .run(payload);
}

export async function deleteAddress(id: number, customerId: number) {
  const db = await getDb();
  await db.prepare("DELETE FROM customer_addresses WHERE id = ? AND customer_id = ?").run(
    id,
    customerId
  );
}
