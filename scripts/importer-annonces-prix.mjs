// Importe les annonces de prix WhatsApp (src/data/prix_extraits_togo.json) dans la base de prix.
// Base LOCALE uniquement pour l'instant : l'import en ligne attend le feu vert de Remyaga.
// Le vendeur (numéro de téléphone) n'est jamais importé. Usage : npm run db:start, puis
//   node scripts/importer-annonces-prix.mjs
import { createClient } from "@supabase/supabase-js";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const { annoncesVersReleves } = await import("../src/cultisia/prix/annonces.ts");

const statut = JSON.parse(execSync("npx supabase status -o json", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }));
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(statut.API_URL)) {
  console.error("Refus : ce script n'écrit que dans la base locale.");
  process.exit(1);
}
const admin = createClient(statut.API_URL, statut.SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const annonces = JSON.parse(readFileSync(new URL("../src/data/prix_extraits_togo.json", import.meta.url), "utf8"));
const releves = annoncesVersReleves(annonces);

const produits = new Map();
const existants = await admin.from("products").select("id, name");
if (existants.error) throw existants.error;
for (const p of existants.data) produits.set(p.name.toLowerCase(), p.id);

let crees = 0;
for (const r of releves) {
  const cle = r.produit.toLowerCase();
  if (!produits.has(cle)) {
    const { data, error } = await admin
      .from("products")
      .insert({ name: r.produit, category: "Annonces", default_unit: r.unite ?? "unité" })
      .select("id")
      .single();
    if (error) throw error;
    produits.set(cle, data.id);
    crees++;
  }
}

const { error } = await admin.from("price_records").insert(
  releves.map((r) => ({
    product_id: produits.get(r.produit.toLowerCase()),
    price: r.prix,
    currency: "FCFA",
    unit: r.unite,
    location: r.lieu,
    record_date: r.date,
    source: r.source,
  })),
);
if (error) throw error;
console.log(`${releves.length} relevés importés sur ${annonces.length} annonces (${crees} produits créés).`);
