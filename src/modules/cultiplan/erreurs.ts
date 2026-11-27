/** Erreur du module Cultiplan, avec un message lisible par l'utilisateur. */
export class ErreurPlan extends Error {
  constructor(
    message: string,
    /** invalide : entrée refusée ; introuvable ; refuse : pas le droit ; fige : plan lancé ou archivé ; base : panne. */
    readonly code: "invalide" | "introuvable" | "refuse" | "fige" | "base",
    readonly details: string[] = [],
  ) {
    super(message);
    this.name = "ErreurPlan";
  }
}

export function erreurBase(error: { code?: string; message: string }): ErreurPlan {
  if (error.code === "42501") return new ErreurPlan("Tu n'as pas le droit de modifier ce plan.", "refuse");
  if (error.code === "PGRST116") return new ErreurPlan("Plan introuvable.", "introuvable");
  if (error.code === "23514" || error.code === "22P02") return new ErreurPlan(`Donnée refusée par la base : ${error.message}`, "invalide");
  return new ErreurPlan(`Erreur de la base : ${error.message}`, "base");
}
