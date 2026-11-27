/** @jest-environment node */
import type { QuestionAffichee } from "@/modules/cultiplan";
import { brouillonInitial, reponseDepuisBrouillon, texteDeReponse } from "./reponse";

const q = (surcharge: Partial<QuestionAffichee>): QuestionAffichee => ({
  cle: "x", temps: "idee", tempsTitre: "Ton idée et toi", libelle: "Question ?", aide: null, type: "texte", unite: null, reponses: [], cible: "profil", champ: "x", valeur: null, etat: "a_poser", ...surcharge,
});
const choix = [{ valeur: "plein", libelle: "À plein temps" }, { valeur: "partiel", libelle: "À temps partiel" }];

describe("réponse à une question de la consultation", () => {
  it("part de la réponse déjà donnée, sinon d'une saisie vide", () => {
    expect(brouillonInitial(q({ type: "choix_multiple" }))).toEqual([]);
    expect(brouillonInitial(q({ type: "liste" }))).toEqual([]);
    expect(brouillonInitial(q({ type: "texte" }))).toBe("");
    expect(brouillonInitial(q({ type: "nombre" }))).toBeNull();
    expect(brouillonInitial(q({ type: "nombre", etat: "repondue", valeur: 12 }))).toBe(12);
    expect(brouillonInitial(q({ type: "nombre", etat: "inconnue" }))).toBeNull();
  });

  it("contrôle un choix, un choix multiple, un nombre, un oui ou non et un texte", () => {
    const c = q({ type: "choix", reponses: choix });
    expect(reponseDepuisBrouillon(c, "plein")).toEqual({ ok: true, valeur: "plein" });
    expect(reponseDepuisBrouillon(c, "autre").ok).toBe(false);
    expect(reponseDepuisBrouillon(c, null).ok).toBe(false);
    expect(reponseDepuisBrouillon(q({ type: "choix_multiple", reponses: choix }), ["plein"])).toEqual({ ok: true, valeur: ["plein"] });
    expect(reponseDepuisBrouillon(q({ type: "choix_multiple", reponses: choix }), []).ok).toBe(false);
    expect(reponseDepuisBrouillon(q({ type: "nombre" }), 0)).toEqual({ ok: true, valeur: 0 });
    expect(reponseDepuisBrouillon(q({ type: "montant" }), -1).ok).toBe(false);
    expect(reponseDepuisBrouillon(q({ type: "montant" }), null).ok).toBe(false);
    expect(reponseDepuisBrouillon(q({ type: "montant" }), Number.NaN).ok).toBe(false);
    expect(reponseDepuisBrouillon(q({ type: "oui_non" }), false)).toEqual({ ok: true, valeur: false });
    expect(reponseDepuisBrouillon(q({ type: "oui_non" }), null).ok).toBe(false);
    expect(reponseDepuisBrouillon(q({ type: "texte" }), "  des tomates ")).toEqual({ ok: true, valeur: "des tomates" });
    expect(reponseDepuisBrouillon(q({ type: "texte" }), "   ").ok).toBe(false);
    expect(reponseDepuisBrouillon(q({ type: "texte" }), "x".repeat(201)).ok).toBe(false);
  });

  it("accepte une liste vide comme « aucun », et vérifie les lignes d'existant et de crédits", () => {
    const existant = q({ type: "liste", cible: "existant" });
    expect(reponseDepuisBrouillon(existant, [])).toEqual({ ok: true, valeur: [] });
    expect(reponseDepuisBrouillon(existant, [{ categorie: "materiel", libelle: " Motopompe ", quantite: null, etat: "bon" }])).toEqual({ ok: true, valeur: [{ categorie: "materiel", libelle: "Motopompe", etat: "bon" }] });
    expect(reponseDepuisBrouillon(existant, [{ libelle: "Motopompe" }])).toMatchObject({ ok: false, message: expect.stringContaining("Ligne 1") });
    expect(reponseDepuisBrouillon(existant, [{ categorie: "materiel", libelle: "x" }]).ok).toBe(false);
    const credits = q({ type: "liste", cible: "credits" });
    expect(reponseDepuisBrouillon(credits, [{ creancier: "Mutuelle", mensualiteFcfa: 15000, moisRestants: null }])).toEqual({ ok: true, valeur: [{ creancier: "Mutuelle", mensualiteFcfa: 15000 }] });
    expect(reponseDepuisBrouillon(credits, [{ mensualiteFcfa: 15000 }, { creancier: "Banque" }])).toMatchObject({ ok: false, message: expect.stringContaining("Crédit 2") });
  });

  it("écrit la réponse donnée en mots simples", () => {
    expect(texteDeReponse(q({ type: "choix", reponses: choix, etat: "repondue", valeur: "plein" }))).toBe("À plein temps");
    expect(texteDeReponse(q({ type: "choix_multiple", reponses: choix, etat: "repondue", valeur: ["plein", "partiel"] }))).toBe("À plein temps, À temps partiel");
    expect(texteDeReponse(q({ type: "montant", unite: "FCFA", etat: "repondue", valeur: 120000 }))).toBe("120 000 FCFA");
    expect(texteDeReponse(q({ type: "oui_non", etat: "repondue", valeur: false }))).toBe("Non");
    expect(texteDeReponse(q({ type: "liste", etat: "repondue", valeur: [] }))).toBe("Aucun");
    expect(texteDeReponse(q({ type: "liste", etat: "repondue", valeur: [{}, {}] }))).toBe("2 éléments");
    expect(texteDeReponse(q({ etat: "inconnue" }))).toBe("Tu ne sais pas encore");
    expect(texteDeReponse(q({ etat: "a_poser" }))).toBe("Pas encore répondu");
  });
});
