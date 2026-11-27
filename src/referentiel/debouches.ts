// Lecture du référentiel pour les débouchés (R3) : la liste des circuits de commercialisation (ref.circuits_commercialisation).
// Aucun prix ni volume ici : ils viennent du porteur, de l'étude de marché ou d'un contrat.
import { z } from "zod";
import type { ClientBase } from "@/core/exploitation";
import type { Database } from "@/types/supabase";
import { ErreurReferentiel, type StatutDonnee } from ".";

type LigneCircuit = Database["ref"]["Tables"]["circuits_commercialisation"]["Row"];

export interface CircuitCommercialisation {
  code: string;
  libelle: string;
  description: string | null;
  contractuel: boolean;
  ordre: number;
  source: string;
  statut: StatutDonnee;
}

const schemaCircuit = z.object({
  code: z.string().regex(/^[a-z0-9_]+$/),
  libelle: z.string().min(2),
  description: z.string().nullable(),
  contractuel: z.boolean(),
  ordre: z.number().int(),
  source: z.string().min(5),
  statut: z.enum(["brouillon_ia", "a_valider", "validee"]),
});

/** Ligne de ref.circuits_commercialisation → circuit validé. Une donnée incohérente est signalée, pas ignorée. */
export function versCircuit(r: LigneCircuit): CircuitCommercialisation {
  const lu = schemaCircuit.safeParse({
    code: r.code,
    libelle: r.libelle,
    description: r.description,
    contractuel: r.contractuel,
    ordre: r.ordre,
    source: r.source,
    statut: r.statut,
  });
  if (!lu.success) {
    const details = lu.error.issues.map((i) => `${i.path.join(".")} : ${i.message}`).join(" ; ");
    throw new ErreurReferentiel(`Donnée du référentiel incohérente (circuit ${r.code}) : ${details}`);
  }
  return lu.data;
}

/** Circuits de commercialisation, dans l'ordre. */
export async function lireCircuits(client: ClientBase): Promise<CircuitCommercialisation[]> {
  const { data, error } = await client.schema("ref").from("circuits_commercialisation").select("*").order("ordre");
  if (error) throw new ErreurReferentiel(`Lecture du référentiel impossible (circuits de commercialisation) : ${error.message}`);
  return data.map(versCircuit);
}
