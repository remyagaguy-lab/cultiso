import { Suspense } from "react";
import { createClient } from "@supabase/supabase-js";
import PriceDashboard from "@/components/cours-des-prix/PriceDashboard";
import { Product, PriceRecord } from "@/types/prices";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "";
const supabase =
  supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

export const revalidate = 60;

export const metadata = {
  title: "Cours des prix | Cultiso",
  description:
    "Suivez les cours des prix des céréales et produits agricoles sur les marchés locaux.",
};

export default async function MarchesPage() {
  let products: Product[] = [];
  let locations: string[] = [];
  let initialData: PriceRecord[] = [];

  if (supabase) {
    try {
      const [productsRes, locationsRes, recordsRes] = await Promise.all([
        supabase.from("products").select("*").order("name"),
        supabase
          .from("price_records")
          .select("location")
          .not("location", "is", null)
          .limit(2000),
        supabase
          .from("price_records")
          .select(
            `
            id,
            price,
            location,
            record_date,
            product_id,
            product:products (
              id,
              name,
              category,
              default_unit
            )
          `
          )
          .order("record_date", { ascending: false })
          .limit(100),
      ]);

      if (productsRes.data) {
        products = productsRes.data as Product[];
      }

      if (locationsRes.data) {
        const locationsSet = new Set<string>();
        locationsRes.data.forEach((item) => {
          if (item.location) locationsSet.add(item.location);
        });
        locations = Array.from(locationsSet).sort();
      }

      if (recordsRes.data) {
        const hiddenCategories = [
          "SERVICE AGRICOLE",
          "CHARGE FIXE",
          "INTRANT",
          "SEMENCE",
        ];
        initialData = (recordsRes.data as unknown as PriceRecord[]).filter(
          (r) => r.product && !hiddenCategories.includes(r.product.category)
        );
      }
    } catch (err) {
      console.error("Erreur lors du chargement des cours des prix:", err);
    }
  }

  return (
    <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-title font-bold text-foreground tracking-[-0.02em] m-0">
            Cours des prix agricoles
          </h1>
          <p className="text-[13.5px] text-muted m-0 mt-1">
            Relevés actualisés des marchés pour piloter vos ventes et marges.
          </p>
        </div>
      </div>

      <Suspense
        fallback={
          <div className="h-64 rounded-[var(--ork-use-radius-card)] bg-surface border border-border flex items-center justify-center text-sm text-muted">
            Chargement des données du marché...
          </div>
        }
      >
        <PriceDashboard
          initialProducts={products}
          initialLocations={locations}
          initialData={initialData}
        />
      </Suspense>
    </div>
  );
}
