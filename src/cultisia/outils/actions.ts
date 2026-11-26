import { z } from "zod";
import { definirOutil } from "./registre";

/**
 * Ancien `prepare_transaction` : prépare une opération de trésorerie dictée par l'utilisateur.
 * Rien n'est enregistré : l'interface pré-remplit le formulaire et l'utilisateur confirme.
 * Le modèle ne multiplie jamais : s'il reçoit une quantité et un prix unitaire, le code calcule le montant.
 */
export const saisirOperation = definirOutil({
  nom: "saisir_operation",
  description:
    "Prépare une opération de trésorerie (dépense ou recette) dictée par l'utilisateur, pour pré-remplir le formulaire. " +
    "N'enregistre rien : l'utilisateur vérifie puis confirme. Ne calcule rien toi-même : donne soit le montant total " +
    "tel que dit par l'utilisateur (amount), soit la quantité et le prix unitaire (quantity, unit_price).",
  famille: "action",
  modules: ["cultima"],
  schema: z
    .object({
      amount: z.number().positive().optional().describe("Montant total en FCFA, s'il est donné tel quel"),
      quantity: z.number().positive().optional().describe("Quantité, si l'utilisateur donne un prix unitaire"),
      unit_price: z.number().positive().optional().describe("Prix unitaire en FCFA"),
      type: z.enum(["income", "expense"]).describe("income : recette (vente, subvention) ; expense : dépense (achat, salaire)"),
      category: z.string().min(1).max(60).describe("Catégorie courte, par exemple Semences, Engrais, Vente maïs"),
      description: z.string().max(300).optional().describe("Précision facultative"),
    })
    .refine((a) => a.amount !== undefined || (a.quantity !== undefined && a.unit_price !== undefined), {
      message: "donner amount, ou bien quantity et unit_price",
    }),
  preparer: (args) => {
    const montant = args.amount ?? Math.round((args.quantity ?? 0) * (args.unit_price ?? 0));
    return {
      amount: montant,
      type: args.type,
      category: args.category,
      ...(args.description ? { description: args.description } : {}),
      ...(args.quantity !== undefined ? { quantity: args.quantity, unit_price: args.unit_price } : {}),
    };
  },
  messagePropose: () =>
    "J'ai préparé l'opération. Vérifie les informations dans le formulaire, puis clique sur « Enregistrer » pour la valider.",
});
