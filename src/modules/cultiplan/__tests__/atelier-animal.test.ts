/** @jest-environment node */
import { POST as POST_BANDES } from "@/app/api/cultiplan/elevage/bandes/route";
import { POST as POST_TROUPEAU } from "@/app/api/cultiplan/elevage/troupeau/route";
import { ErreurMoteur } from "@/moteurs";
import type { VarianteElevage } from "@/referentiel/elevage";
import { simulerAtelierAnimal, type ParametresAtelierAnimal } from "../atelier-animal";
import { remplacerFabrique } from "../http";
import { fauxClientProfil } from "../test-utils/fausse-base-profil";

const points = (valeurs: number[]) => valeurs.map((valeur, i) => ({ age: i + 1, valeur }));
const parametreRef = (valeur: number, unite: string) => ({ valeur, unite, source: "Source d'essai p. 1", dateSource: "2026-11-27", statut: "brouillon_ia" as const });
// Variante d'ESSAI, inventée pour ce test seulement.
const variante = (o: Partial<VarianteElevage> = {}): VarianteElevage => ({
  variante: "essai",
  courbes: { mortalite: points([0.1, 0, 0, 0, 0]), consommation: points([20, 50, 100, 100, 100]), production: points([0, 0, 0.5, 0.5, 0.5]), poids: [] },
  parametres: { age_reforme_mois: parametreRef(5, "mois"), jours_par_mois: parametreRef(30, "jours") },
  sources: ["Source d'essai p. 1"],
  statut: "brouillon_ia",
  ...o,
});
const parametres: ParametresAtelierAnimal = { bandes: [{ debutMois: 1, effectif: 100 }], prix: { animal: 1000, aliment: 200, produit: 100, reforme: 2000 } };

describe("atelier animal à bandes : service (M14)", () => {
  it("calcule avec les courbes du référentiel et dit d'où viennent les chiffres", () => {
    const r = simulerAtelierAnimal({ speculation: "Poule pondeuse", variantes: [variante()], parametres });
    expect(r.statut).toBe("calculee");
    expect(r.variante).toBe("essai");
    expect(r.resultat?.coutAnimalPretAProduire?.total).toBe(139000);
    expect(r.origine?.sources).toEqual(["Source d'essai p. 1"]);
    expect(r.origine?.dureeBandeMois).toContain("Source d'essai p. 1");
    expect(r.origine?.prix).toContain("fournis par l'appelant");
    expect(r.donneesNonValidees).toBe(true);
  });

  it("référentiel vide ou courbes incomplètes : non évalué, avec ce qui manque, aucune courbe inventée", () => {
    const vide = simulerAtelierAnimal({ speculation: "Tilapia", variantes: [], parametres });
    expect(vide).toMatchObject({ statut: "non_evaluee", resultat: null });
    expect(vide.manques[0]).toContain("aucune courbe");
    const partiel = simulerAtelierAnimal({
      speculation: "Poulet de chair",
      variantes: [variante({ variante: "mali", courbes: { mortalite: [], consommation: [], production: [], poids: [{ age: 2, valeur: 1.8 }] } })],
      parametres: { ...parametres, variante: "mali" },
    });
    expect(partiel.statut).toBe("non_evaluee");
    expect(partiel.manques[0]).toContain("mortalité, consommation d'aliment, production");
  });

  it("durée de la bande et jours par mois : du référentiel, sinon de l'appelant avec sa source, sinon non évalué", () => {
    const sansParametres = variante({ parametres: {} });
    const manque = simulerAtelierAnimal({ speculation: "x", variantes: [sansParametres], parametres });
    expect(manque.statut).toBe("non_evaluee");
    expect(manque.manques.join(" ")).toContain("durée de la bande");
    expect(manque.manques.join(" ")).toContain("jours comptés par mois");
    const donne = simulerAtelierAnimal({
      speculation: "x",
      variantes: [sansParametres],
      parametres: { ...parametres, dureeBandeMois: { valeur: 5, source: "Technicien ICAT" }, joursParMois: { valeur: 30, source: "Convention du porteur" } },
    });
    expect(donne.statut).toBe("calculee");
    expect(donne.origine?.dureeBandeMois).toContain("Technicien ICAT");
    // une source vide est refusée
    expect(() => simulerAtelierAnimal({ speculation: "x", variantes: [sansParametres], parametres: { ...parametres, dureeBandeMois: { valeur: 5, source: "" } } })).toThrow(ErreurMoteur);
  });

  it("plusieurs variantes complètes : le choix est demandé, jamais fait à la place du porteur ; variante inconnue refusée", () => {
    const deux = [variante(), variante({ variante: "autre" })];
    expect(() => simulerAtelierAnimal({ speculation: "x", variantes: deux, parametres })).toThrow(/choisis-en une \(essai, autre\)/);
    expect(simulerAtelierAnimal({ speculation: "x", variantes: deux, parametres: { ...parametres, variante: "autre" } }).variante).toBe("autre");
    expect(() => simulerAtelierAnimal({ speculation: "x", variantes: deux, parametres: { ...parametres, variante: "zzz" } })).toThrow(/Variante inconnue/);
  });

  it("une courbe trop courte pour la durée choisie est refusée par le moteur, sans prolongement", () => {
    expect(() => simulerAtelierAnimal({ speculation: "x", variantes: [variante()], parametres: { ...parametres, dureeBandeMois: { valeur: 8, source: "essai" } } })).toThrow(/n'a pas de valeur pour le mois 6/);
  });
});

describe("routes de l'élevage", () => {
  const requete = (chemin: string, corps: unknown, jeton: string | null = "jeton-valide") =>
    new Request(`http://localhost/api/cultiplan/elevage/${chemin}`, { method: "POST", headers: jeton ? { Authorization: `Bearer ${jeton}` } : {}, body: JSON.stringify(corps) });

  it("refuse sans jeton (401) et un corps invalide (400) ; le cheptel en flux répond avec ses comptes", async () => {
    const { client } = fauxClientProfil();
    const precedente = remplacerFabrique(async (jeton) => (jeton === "jeton-valide" ? client : null));
    try {
      expect((await POST_BANDES(requete("bandes", {}, null))).status).toBe(401);
      const sansSource = await POST_BANDES(requete("bandes", { speculation: "poule pondeuse", ...parametres, dureeBandeMois: { valeur: 5, source: "" } }));
      expect(sansSource.status).toBe(400);
      expect((await POST_TROUPEAU(requete("troupeau", { horizonMois: 0 }))).status).toBe(400);
      const ok = await POST_TROUPEAU(
        requete("troupeau", { horizonMois: 3, categories: [{ code: "brebis", effectifInitial: 10 }], mouvements: [{ mois: 2, categorie: "brebis", type: "naissance", effectif: 4 }] }),
      );
      expect(ok.status).toBe(200);
      expect((await ok.json()).categories[0]).toMatchObject({ fin: 14, croit: 4 });
      const refuse = await POST_TROUPEAU(requete("troupeau", { horizonMois: 3, categories: [{ code: "brebis", effectifInitial: 1 }], mouvements: [{ mois: 1, categorie: "brebis", type: "vente", effectif: 5 }] }));
      expect(refuse.status).toBe(400);
    } finally {
      remplacerFabrique(precedente);
    }
  });
});
