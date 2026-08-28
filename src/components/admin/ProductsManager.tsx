"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatPrice } from "@/lib/format";
import { ImageUploadField } from "@/components/admin/ImageUploadField";
import type { Category, Extra, ProductWithOptions } from "@/lib/types";

type SizeRow = { label: string; price_delta: number; weight_label: string };
type ExtraOptionRow = { label: string; price: number };

const emptyProductForm = {
  id: null as number | null,
  category_id: 0,
  name: "",
  description: "",
  image: "",
  base_price: "" as string | number,
  is_pizza: false,
  featured: false,
  active: true,
  sizes: [] as SizeRow[],
};

export function ProductsManager({
  initialCategories,
  initialProducts,
  initialExtras,
}: {
  initialCategories: Category[];
  initialProducts: ProductWithOptions[];
  initialExtras: Extra[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"products" | "categories" | "extras">("products");
  const [categories, setCategories] = useState(initialCategories);
  const [products, setProducts] = useState(initialProducts);
  const [extras, setExtras] = useState(initialExtras);

  const [productForm, setProductForm] = useState(emptyProductForm);
  const [showProductForm, setShowProductForm] = useState(false);

  const [categoryForm, setCategoryForm] = useState({
    id: null as number | null,
    slug: "",
    name: "",
    icon: "",
  });
  const [showCategoryForm, setShowCategoryForm] = useState(false);

  const [extraForm, setExtraForm] = useState({
    id: null as number | null,
    name: "",
    price: "" as string | number,
    category_id: "" as string | number,
    options: [] as ExtraOptionRow[],
  });
  const [showExtraForm, setShowExtraForm] = useState(false);

  function refresh() {
    router.refresh();
  }

  // ---------- Categories ----------
  async function saveCategory() {
    if (!categoryForm.name || !categoryForm.slug) return;
    if (categoryForm.id) {
      await fetch(`/api/admin/categories/${categoryForm.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: categoryForm.name,
          slug: categoryForm.slug,
          icon: categoryForm.icon,
        }),
      });
      const editedId = categoryForm.id;
      setCategories((prev) =>
        prev.map((c) =>
          c.id === editedId
            ? { ...c, name: categoryForm.name, slug: categoryForm.slug, icon: categoryForm.icon }
            : c
        )
      );
    } else {
      const res = await fetch("/api/admin/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(categoryForm),
      });
      const data = await res.json();
      const newCategory: Category = {
        id: data.id,
        slug: categoryForm.slug,
        name: categoryForm.name,
        icon: categoryForm.icon,
        sort_order: 0,
        active: 1,
      };
      setCategories((prev) => [...prev, newCategory]);
    }
    setShowCategoryForm(false);
    setCategoryForm({ id: null, slug: "", name: "", icon: "" });
    refresh();
  }

  async function toggleCategoryActive(cat: Category) {
    await fetch(`/api/admin/categories/${cat.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: cat.active ? 0 : 1 }),
    });
    setCategories((prev) =>
      prev.map((c) => (c.id === cat.id ? { ...c, active: cat.active ? 0 : 1 } : c))
    );
  }

  async function deleteCategory(id: number) {
    if (!confirm("Изтриване на категорията и всички продукти в нея?")) return;
    await fetch(`/api/admin/categories/${id}`, { method: "DELETE" });
    setCategories((prev) => prev.filter((c) => c.id !== id));
    setProducts((prev) => prev.filter((p) => p.category_id !== id));
  }

  // Re-numbers every category 0..n-1 in its new order and saves all of
  // them — simplest way to keep sort_order clean even when everything
  // started out at the same default value.
  async function moveCategory(id: number, direction: -1 | 1) {
    const idx = categories.findIndex((c) => c.id === id);
    const swapIdx = idx + direction;
    if (idx < 0 || swapIdx < 0 || swapIdx >= categories.length) return;
    const reordered = [...categories];
    [reordered[idx], reordered[swapIdx]] = [reordered[swapIdx], reordered[idx]];
    const withOrder = reordered.map((c, i) => ({ ...c, sort_order: i }));
    setCategories(withOrder);
    await Promise.all(
      withOrder.map((c) =>
        fetch(`/api/admin/categories/${c.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sort_order: c.sort_order }),
        })
      )
    );
  }

  // ---------- Products ----------
  function openNewProduct() {
    setProductForm({
      ...emptyProductForm,
      category_id: categories[0]?.id ?? 0,
      sizes: [{ label: "Стандартна", price_delta: 0, weight_label: "" }],
    });
    setShowProductForm(true);
  }

  function openEditProduct(p: ProductWithOptions) {
    setProductForm({
      id: p.id,
      category_id: p.category_id,
      name: p.name,
      description: p.description,
      image: p.image,
      base_price: p.base_price,
      is_pizza: p.is_pizza === 1,
      featured: p.featured === 1,
      active: p.active === 1,
      sizes: p.sizes.map((s) => ({
        label: s.label,
        price_delta: s.price_delta,
        weight_label: s.weight_label ?? "",
      })),
    });
    setShowProductForm(true);
  }

  function updateSizeRow(idx: number, patch: Partial<SizeRow>) {
    setProductForm((f) => ({
      ...f,
      sizes: f.sizes.map((s, i) => (i === idx ? { ...s, ...patch } : s)),
    }));
  }

  function addSizeRow() {
    setProductForm((f) => ({
      ...f,
      sizes: [...f.sizes, { label: "", price_delta: 0, weight_label: "" }],
    }));
  }

  function removeSizeRow(idx: number) {
    setProductForm((f) => ({ ...f, sizes: f.sizes.filter((_, i) => i !== idx) }));
  }

  async function saveProduct() {
    if (!productForm.name || !productForm.category_id || productForm.base_price === "") {
      alert("Попълнете име, категория и базова цена.");
      return;
    }
    const payload = {
      category_id: productForm.category_id,
      name: productForm.name,
      description: productForm.description,
      image: productForm.image,
      base_price: Number(productForm.base_price),
      is_pizza: productForm.is_pizza,
      featured: productForm.featured,
      active: productForm.active,
      sizes: productForm.sizes.filter((s) => s.label),
    };
    if (productForm.id) {
      await fetch(`/api/admin/products/${productForm.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else {
      await fetch("/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }
    setShowProductForm(false);
    refresh();
    // re-fetch products list
    const res = await fetch("/api/admin/products");
    const data = await res.json();
    setProducts(data.products ?? []);
  }

  async function toggleProductActive(p: ProductWithOptions) {
    await fetch(`/api/admin/products/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !p.active }),
    });
    setProducts((prev) =>
      prev.map((x) => (x.id === p.id ? { ...x, active: p.active ? 0 : 1 } : x))
    );
  }

  async function deleteProduct(id: number) {
    if (!confirm("Изтриване на продукта?")) return;
    await fetch(`/api/admin/products/${id}`, { method: "DELETE" });
    setProducts((prev) => prev.filter((p) => p.id !== id));
  }

  // Reorders a product only among the others in the SAME category (that's
  // the visual group it moves within on the menu) — re-numbers just that
  // group 0..n-1, leaving every other category's ordering untouched.
  async function moveProduct(id: number, direction: -1 | 1) {
    const product = products.find((p) => p.id === id);
    if (!product) return;
    const siblings = products.filter((p) => p.category_id === product.category_id);
    const idx = siblings.findIndex((p) => p.id === id);
    const swapIdx = idx + direction;
    if (idx < 0 || swapIdx < 0 || swapIdx >= siblings.length) return;
    const reordered = [...siblings];
    [reordered[idx], reordered[swapIdx]] = [reordered[swapIdx], reordered[idx]];
    const withOrder = reordered.map((p, i) => ({ ...p, sort_order: i }));
    const byId = new Map(withOrder.map((p) => [p.id, p]));
    setProducts((prev) => prev.map((p) => byId.get(p.id) ?? p));
    await Promise.all(
      withOrder.map((p) =>
        fetch(`/api/admin/products/${p.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sort_order: p.sort_order }),
        })
      )
    );
  }

  // ---------- Extras ----------
  function addExtraOptionRow() {
    setExtraForm((f) => ({ ...f, options: [...f.options, { label: "", price: 0 }] }));
  }

  function updateExtraOptionRow(idx: number, patch: Partial<ExtraOptionRow>) {
    setExtraForm((f) => ({
      ...f,
      options: f.options.map((o, i) => (i === idx ? { ...o, ...patch } : o)),
    }));
  }

  function removeExtraOptionRow(idx: number) {
    setExtraForm((f) => ({ ...f, options: f.options.filter((_, i) => i !== idx) }));
  }

  async function saveExtra() {
    if (!extraForm.name || extraForm.price === "") return;
    const payload = {
      name: extraForm.name,
      price: Number(extraForm.price),
      category_id: extraForm.category_id ? Number(extraForm.category_id) : null,
      options: extraForm.options.filter((o) => o.label),
    };
    if (extraForm.id) {
      await fetch(`/api/admin/extras/${extraForm.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else {
      await fetch("/api/admin/extras", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }
    setShowExtraForm(false);
    setExtraForm({ id: null, name: "", price: "", category_id: "", options: [] });
    const res = await fetch("/api/admin/extras");
    const data = await res.json();
    setExtras(data.extras ?? []);
  }

  async function deleteExtra(id: number) {
    if (!confirm("Изтриване на добавката?")) return;
    await fetch(`/api/admin/extras/${id}`, { method: "DELETE" });
    setExtras((prev) => prev.filter((e) => e.id !== id));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="font-display font-extrabold text-2xl">Продукти и меню</h1>
        <div className="flex gap-2">
          {(["products", "categories", "extras"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`text-sm font-semibold px-3.5 py-2 rounded-full border shadow-sm ${
                tab === t
                  ? "bg-brand text-white border-brand"
                  : "bg-surface border-border text-foreground/70"
              }`}
            >
              {t === "products" ? "Продукти" : t === "categories" ? "Категории" : "Добавки"}
            </button>
          ))}
        </div>
      </div>

      {tab === "products" && (
        <div className="space-y-4">
          <button
            onClick={openNewProduct}
            className="bg-brand text-white rounded-xl px-4 py-2.5 font-semibold text-sm"
          >
            + Нов продукт
          </button>
          <div className="space-y-6">
            {categories.map((cat) => {
              const inCategory = products.filter((p) => p.category_id === cat.id);
              if (inCategory.length === 0) return null;
              return (
                <div key={cat.id}>
                  <p className="font-semibold text-sm text-muted mb-2">
                    {cat.icon} {cat.name}
                  </p>
                  <div className="grid gap-3">
                    {inCategory.map((p, idx) => (
                      <div
                        key={p.id}
                        className="bg-surface rounded-2xl border border-border p-4 flex items-center justify-between gap-3 flex-wrap"
                      >
                        <div className="flex items-center gap-2">
                          <div className="flex flex-col">
                            <button
                              onClick={() => moveProduct(p.id, -1)}
                              disabled={idx === 0}
                              className="h-6 w-6 grid place-items-center text-muted disabled:opacity-25"
                              aria-label="Премести нагоре"
                            >
                              ▲
                            </button>
                            <button
                              onClick={() => moveProduct(p.id, 1)}
                              disabled={idx === inCategory.length - 1}
                              className="h-6 w-6 grid place-items-center text-muted disabled:opacity-25"
                              aria-label="Премести надолу"
                            >
                              ▼
                            </button>
                          </div>
                          <div>
                            <p className="font-semibold">{p.name}</p>
                            <p className="text-sm text-muted">{formatPrice(p.base_price)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => toggleProductActive(p)}
                            className={`text-xs font-semibold px-3 py-1.5 rounded-full ${
                              p.active ? "bg-success/10 text-success" : "bg-black/5 text-muted"
                            }`}
                          >
                            {p.active ? "Активен" : "Скрит"}
                          </button>
                          <button
                            onClick={() => openEditProduct(p)}
                            className="text-xs font-semibold px-3 py-1.5 rounded-full border border-border"
                          >
                            Редакция
                          </button>
                          <button
                            onClick={() => deleteProduct(p.id)}
                            className="text-xs font-semibold px-3 py-1.5 rounded-full border border-border text-brand"
                          >
                            Изтрий
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === "categories" && (
        <div className="space-y-4">
          <button
            onClick={() => {
              setCategoryForm({ id: null, slug: "", name: "", icon: "" });
              setShowCategoryForm(true);
            }}
            className="bg-brand text-white rounded-xl px-4 py-2.5 font-semibold text-sm"
          >
            + Нова категория
          </button>
          <div className="grid gap-3">
            {categories.map((c, idx) => (
              <div
                key={c.id}
                className="bg-surface rounded-2xl border border-border p-4 flex items-center justify-between gap-3 flex-wrap"
              >
                <div className="flex items-center gap-2">
                  <div className="flex flex-col">
                    <button
                      onClick={() => moveCategory(c.id, -1)}
                      disabled={idx === 0}
                      className="h-6 w-6 grid place-items-center text-muted disabled:opacity-25"
                      aria-label="Премести нагоре"
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => moveCategory(c.id, 1)}
                      disabled={idx === categories.length - 1}
                      className="h-6 w-6 grid place-items-center text-muted disabled:opacity-25"
                      aria-label="Премести надолу"
                    >
                      ▼
                    </button>
                  </div>
                  <p className="font-semibold">
                    {c.icon} {c.name} <span className="text-xs text-muted">/{c.slug}</span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleCategoryActive(c)}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-full ${
                      c.active ? "bg-success/10 text-success" : "bg-black/5 text-muted"
                    }`}
                  >
                    {c.active ? "Активна" : "Скрита"}
                  </button>
                  <button
                    onClick={() => {
                      setCategoryForm({ id: c.id, slug: c.slug, name: c.name, icon: c.icon });
                      setShowCategoryForm(true);
                    }}
                    className="text-xs font-semibold px-3 py-1.5 rounded-full border border-border"
                  >
                    Редакция
                  </button>
                  <button
                    onClick={() => deleteCategory(c.id)}
                    className="text-xs font-semibold px-3 py-1.5 rounded-full border border-border text-brand"
                  >
                    Изтрий
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "extras" && (
        <div className="space-y-4">
          <button
            onClick={() => {
              setExtraForm({ id: null, name: "", price: "", category_id: "", options: [] });
              setShowExtraForm(true);
            }}
            className="bg-brand text-white rounded-xl px-4 py-2.5 font-semibold text-sm"
          >
            + Нова добавка
          </button>
          <div className="grid gap-3">
            {extras.map((e) => (
              <div
                key={e.id}
                className="bg-surface rounded-2xl border border-border p-4 flex items-center justify-between gap-3 flex-wrap"
              >
                <p className="font-semibold">
                  {e.name}{" "}
                  <span className="text-xs text-muted font-normal">
                    {e.category_id
                      ? categories.find((c) => c.id === e.category_id)?.name
                      : "Всички категории"}
                  </span>
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">
                    {e.options.length > 0
                      ? `${e.options.length} опции`
                      : formatPrice(e.price)}
                  </span>
                  <button
                    onClick={() => {
                      setExtraForm({
                        id: e.id,
                        name: e.name,
                        price: e.price,
                        category_id: e.category_id ?? "",
                        options: e.options.map((o) => ({ label: o.label, price: o.price })),
                      });
                      setShowExtraForm(true);
                    }}
                    className="text-xs font-semibold px-3 py-1.5 rounded-full border border-border"
                  >
                    Редакция
                  </button>
                  <button
                    onClick={() => deleteExtra(e.id)}
                    className="text-xs font-semibold px-3 py-1.5 rounded-full border border-border text-brand"
                  >
                    Изтрий
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Product form modal */}
      {showProductForm && (
        <Modal onClose={() => setShowProductForm(false)} title={productForm.id ? "Редакция на продукт" : "Нов продукт"}>
          <div className="space-y-3">
            <select
              className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm"
              value={productForm.category_id}
              onChange={(e) =>
                setProductForm((f) => ({ ...f, category_id: Number(e.target.value) }))
              }
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon} {c.name}
                </option>
              ))}
            </select>
            <input
              className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm"
              placeholder="Име на продукта"
              value={productForm.name}
              onChange={(e) => setProductForm((f) => ({ ...f, name: e.target.value }))}
            />
            <textarea
              className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm"
              placeholder="Описание"
              rows={2}
              value={productForm.description}
              onChange={(e) => setProductForm((f) => ({ ...f, description: e.target.value }))}
            />
            <ImageUploadField
              value={productForm.image}
              onChange={(url) => setProductForm((f) => ({ ...f, image: url }))}
            />
            <input
              type="number"
              step="0.01"
              className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm"
              placeholder="Базова цена (€)"
              value={productForm.base_price}
              onChange={(e) => setProductForm((f) => ({ ...f, base_price: e.target.value }))}
            />

            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={productForm.featured}
                  onChange={(e) => setProductForm((f) => ({ ...f, featured: e.target.checked }))}
                />
                Хит на менюто
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={productForm.active}
                  onChange={(e) => setProductForm((f) => ({ ...f, active: e.target.checked }))}
                />
                Активен
              </label>
            </div>

            <div>
              <p className="font-semibold text-sm mb-2">Размери / варианти</p>
              <div className="space-y-2">
                {productForm.sizes.map((s, idx) => (
                  <div key={idx} className="rounded-lg border border-border p-2 space-y-2">
                    <div className="flex gap-2 items-center">
                      <input
                        className="flex-1 rounded-lg border border-border px-3 py-2 text-sm"
                        placeholder="Етикет (напр. 32см)"
                        value={s.label}
                        onChange={(e) => updateSizeRow(idx, { label: e.target.value })}
                      />
                      <input
                        type="number"
                        step="0.01"
                        className="w-24 rounded-lg border border-border px-3 py-2 text-sm"
                        placeholder="+ цена"
                        value={s.price_delta}
                        onChange={(e) =>
                          updateSizeRow(idx, { price_delta: Number(e.target.value) })
                        }
                      />
                      <button
                        onClick={() => removeSizeRow(idx)}
                        className="text-brand text-sm font-semibold px-2"
                      >
                        ✕
                      </button>
                    </div>
                    <input
                      className="w-full rounded-lg border border-border px-3 py-2 text-sm"
                      placeholder="Грамаж за този размер (напр. 300г, 1.2кг)"
                      value={s.weight_label}
                      onChange={(e) => updateSizeRow(idx, { weight_label: e.target.value })}
                    />
                  </div>
                ))}
                <button
                  onClick={addSizeRow}
                  className="text-sm font-semibold text-brand"
                >
                  + Добави размер
                </button>
              </div>
            </div>

            <button
              onClick={saveProduct}
              className="w-full bg-brand text-white rounded-xl py-3 font-bold mt-2"
            >
              Запази продукта
            </button>
          </div>
        </Modal>
      )}

      {/* Category form modal */}
      {showCategoryForm && (
        <Modal onClose={() => setShowCategoryForm(false)} title={categoryForm.id ? "Редакция на категория" : "Нова категория"}>
          <div className="space-y-3">
            <input
              className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm"
              placeholder="Емоджи икона (напр. 🍕)"
              value={categoryForm.icon}
              onChange={(e) => setCategoryForm((f) => ({ ...f, icon: e.target.value }))}
            />
            <input
              className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm"
              placeholder="Име (напр. Пици)"
              value={categoryForm.name}
              onChange={(e) => setCategoryForm((f) => ({ ...f, name: e.target.value }))}
            />
            <input
              className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm"
              placeholder="slug (напр. pizza)"
              value={categoryForm.slug}
              onChange={(e) => setCategoryForm((f) => ({ ...f, slug: e.target.value }))}
            />
            <button
              onClick={saveCategory}
              className="w-full bg-brand text-white rounded-xl py-3 font-bold mt-2"
            >
              Запази категорията
            </button>
          </div>
        </Modal>
      )}

      {/* Extra form modal */}
      {showExtraForm && (
        <Modal onClose={() => setShowExtraForm(false)} title={extraForm.id ? "Редакция на добавка" : "Нова добавка"}>
          <div className="space-y-3">
            <input
              className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm"
              placeholder="Име на добавката"
              value={extraForm.name}
              onChange={(e) => setExtraForm((f) => ({ ...f, name: e.target.value }))}
            />
            <input
              type="number"
              step="0.01"
              className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm"
              placeholder="Цена (€)"
              value={extraForm.price}
              onChange={(e) => setExtraForm((f) => ({ ...f, price: e.target.value }))}
            />
            {extraForm.options.length > 0 && (
              <p className="text-xs text-muted -mt-1">
                Цената по-горе не се ползва, докато има опции по-долу — клиентът избира от тях.
              </p>
            )}
            <select
              className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm"
              value={extraForm.category_id}
              onChange={(e) => setExtraForm((f) => ({ ...f, category_id: e.target.value }))}
            >
              <option value="">Всички категории</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon} {c.name}
                </option>
              ))}
            </select>

            <div>
              <p className="font-semibold text-sm mb-2">
                Опции (напр. няколко теглà на една и съща добавка)
              </p>
              <div className="space-y-2">
                {extraForm.options.map((o, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <input
                      className="flex-1 rounded-lg border border-border px-3 py-2 text-sm"
                      placeholder="Етикет (напр. 100 гр.)"
                      value={o.label}
                      onChange={(e) => updateExtraOptionRow(idx, { label: e.target.value })}
                    />
                    <input
                      type="number"
                      step="0.01"
                      className="w-24 rounded-lg border border-border px-3 py-2 text-sm"
                      placeholder="Цена"
                      value={o.price}
                      onChange={(e) =>
                        updateExtraOptionRow(idx, { price: Number(e.target.value) })
                      }
                    />
                    <button
                      onClick={() => removeExtraOptionRow(idx)}
                      className="text-brand text-sm font-semibold px-2"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button onClick={addExtraOptionRow} className="text-sm font-semibold text-brand">
                  + Добави опция
                </button>
              </div>
            </div>

            <button
              onClick={saveExtra}
              className="w-full bg-brand text-white rounded-xl py-3 font-bold mt-2"
            >
              Запази добавката
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <button className="absolute inset-0 bg-black/50" onClick={onClose} aria-label="Затвори" />
      <div className="relative bg-surface w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-bold text-lg">{title}</h2>
          <button onClick={onClose} className="h-8 w-8 rounded-full bg-black/5 grid place-items-center">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
