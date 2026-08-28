import { listCategories } from "@/lib/repos/categories";
import { listProducts, listExtras } from "@/lib/repos/products";
import { ProductsManager } from "@/components/admin/ProductsManager";

export const dynamic = "force-dynamic";

export default async function AdminProductsPage() {
  const categories = await listCategories(false);
  const products = await listProducts({ activeOnly: false });
  const extras = await listExtras();

  return (
    <ProductsManager
      initialCategories={categories}
      initialProducts={products}
      initialExtras={extras}
    />
  );
}
