/** @jest-environment node */
import { ErreurPlan } from "../erreurs";
import {
  enregistrerReponses,
  etatQuestion,
  evaluer,
  manques,
  pointDeFaisabilite,
  prochaineQuestion,
  traduireReponse,
  VALEUR_INCONNUE,
  type EtatEntretien,
} from "../entretien";
import { lireProfil } from "../profil";
import { entretienDeDepart } from "../test-utils/entretien-depart";
import { fauxClientProfil } from "../test-utils/fausse-base-profil";
import { ProfilPorteurVide } from "../test-utils/profil-vide";

const entretien = entretienDeDepart();
const etat = (valeurs: Parameters<typeof ProfilPorteurVide>[0] = {}, reste: Pick<EtatEntretien, "contexte" | "secteurs" | "reportees"> extends infer E ? Partial<E> & { profil?: Parameters<typeof ProfilPorteurVide>[1] } : never = {}): EtatEntretien => ({
  profil: ProfilPorteurVide(valeurs, reste.profil),
  contexte: reste.contexte ?? {},
  secteurs: reste.secteurs,
  reportees: reste.reportees,
});
const q = (cle: string) => entretien.questions.find((x) => x.cle === cle)!;
const cleSuivante = (e: EtatEntretien) => prochaineQuestion(entretien, e).question?.cle;

describe("conditions", () => {
  it("comparent à une constante ; une valeur absente ne vérifie rien, sauf « inconnu »", () => {
    const plates = { a: "x", n: 4, b: true, m: "a,b", vide: null };
    expect(evaluer({ champ: "a", op: "egal", valeur: "x" }, plates)).toBe(true);
    expect(evaluer({ champ: "a", op: "pas_dans", valeurs: ["y"] }, plates)).toBe(true);
    expect(evaluer({ champ: "vide", op: "pas_dans", valeurs: ["y"] }, plates)).toBe(false);
    expect(evaluer({ champ: "vide", op: "inconnu" }, plates)).toBe(true);
    expect(evaluer({ champ: "n", op: "inferieur", valeur: 5 }, plates)).toBe(true);
    expect(evaluer({ champ: "n", op: "superieur", valeur: 5 }, plates)).toBe(false);
    expect(evaluer({ champ: "vide", op: "inferieur", valeur: 5 }, plates)).toBe(false);
    expect(evaluer({ champ: "b", op: "vrai" }, plates)).toBe(true);
    expect(evaluer({ champ: "m", op: "dans", valeurs: ["b"] }, plates)).toBe(true);
    expect(evaluer({ un_des: [{ champ: "a", op: "egal", valeur: "z" }, { champ: "n", op: "egal", valeur: 4 }] }, plates)).toBe(true);
    expect(evaluer({ tous: [{ champ: "a", op: "egal", valeur: "z" }, { champ: "n", op: "egal", valeur: 4 }] }, plates)).toBe(false);
  });
});

describe("prochaine question", () => {
  it("commence par l'idée, avec l'introduction du premier temps", () => {
    const p = prochaineQuestion(entretien, etat());
    expect(p.fini).toBe(false);
    expect(p.question?.cle).toBe("idee");
    expect(p.temps?.cle).toBe("idee");
    expect(p.introTemps).toMatch(/comprendre/);
  });

  it("avance selon les réponses, sans reposer une question répondue et sans répéter l'introduction du temps", () => {
    const e = etat({ avancement: "idee" }, { contexte: { idee: "des tomates" } });
    const p = prochaineQuestion(entretien, e);
    expect(p.question?.cle).toBe("finalites");
    expect(p.introTemps).toBeNull();
    expect(p.avancement[0]).toMatchObject({ temps: "idee", traitees: 2 });
  });

  it("« je ne sais pas » compte comme traité : on passe à la suivante", () => {
    const e = etat({}, { contexte: { idee: "des tomates" }, profil: { inconnus: ["avancement"] } });
    expect(etatQuestion(q("avancement"), e)).toBe("inconnue");
    expect(cleSuivante(e)).toBe("finalites");
  });

  it("saute les questions sans objet : pas de surface ni de pièce sans terre, pas de durée pour un propriétaire", () => {
    const base = { avancement: "idee", finalites: ["revenu"], competenceTechnique: "moyen", competenceGestion: "moyen", competenceVente: "moyen", tempsEngagement: "plein", tempsHeuresSemaine: 30 };
    const contexte = { idee: "x", objectif: "activite_principale" };
    const sansTerre = etat({ ...base, terreStatut: "aucun" }, { contexte });
    expect(etatQuestion(q("terre_surface"), sansTerre)).toBe("masquee");
    expect(cleSuivante(sansTerre)).toBe("eau_source");
    const proprio = etat({ ...base, terreStatut: "propriete" }, { contexte });
    expect(cleSuivante(proprio)).toBe("terre_surface");
    expect(etatQuestion(q("terre_duree"), proprio)).toBe("masquee");
    expect(etatQuestion(q("terre_duree"), etat({ terreStatut: "location" }))).toBe("a_poser");
  });

  it("ne pose pas l'autre activité à un porteur à plein temps, ni l'heure de la famille sans aide familiale", () => {
    expect(etatQuestion(q("temps_autre_activite"), etat({ tempsEngagement: "plein" }))).toBe("masquee");
    expect(etatQuestion(q("temps_autre_activite"), etat({ tempsEngagement: "partiel" }))).toBe("a_poser");
    expect(etatQuestion(q("famille_heures"), etat({ familleActifs: 0 }))).toBe("masquee");
    expect(etatQuestion(q("famille_heures"), etat({ familleActifs: 3 }))).toBe("a_poser");
  });

  it("ne pose les questions d'un secteur que si le porteur en relève", () => {
    expect(etatQuestion(q("terrain_logement"), etat())).toBe("masquee");
    expect(etatQuestion(q("terrain_logement"), etat({}, { secteurs: ["vegetal"] }))).toBe("masquee");
    expect(etatQuestion(q("terrain_logement"), etat({}, { secteurs: ["animal"] }))).toBe("a_poser");
    expect(etatQuestion(q("terrain_mecanisation"), etat({}, { secteurs: ["vegetal"] }))).toBe("a_poser");
  });

  it("les questions sur le contrat et la promesse ne viennent que s'il y a un acheteur", () => {
    expect(etatQuestion(q("marche_contrat"), etat({}, { contexte: { marche_acheteur: "cherche" } }))).toBe("masquee");
    expect(etatQuestion(q("marche_contrat"), etat({}, { contexte: { marche_acheteur: "oui_identifie" } }))).toBe("a_poser");
    expect(etatQuestion(q("marche_promesse"), etat({}, { contexte: { marche_acheteur: "oui_identifie" } }))).toBe("a_poser");
  });

  it("l'eau du contexte n'est demandée que pour une rivière ou une retenue (sinon elle vient de la source d'eau)", () => {
    expect(etatQuestion(q("terrain_eau"), etat({ eauSource: "puits" }))).toBe("masquee");
    expect(etatQuestion(q("terrain_eau"), etat({ eauSource: "cours_eau" }))).toBe("a_poser");
  });

  it("les questions reportées sont sautées mais restent dans les manques", () => {
    const e = etat({}, { reportees: ["idee"] });
    expect(etatQuestion(q("idee"), e)).toBe("reportee");
    expect(cleSuivante(e)).toBe("avancement");
    expect(manques(entretien, e).find((m) => m.question.cle === "idee")?.etat).toBe("reportee");
  });

  it("une liste vide veut dire « pas demandé » tant que le porteur n'a pas dit « aucun »", () => {
    expect(etatQuestion(q("existant_liste"), etat())).toBe("a_poser");
    expect(etatQuestion(q("existant_liste"), etat({}, { profil: { sansExistant: true } }))).toBe("repondue");
    expect(etatQuestion(q("credits_liste"), etat({}, { profil: { inconnus: ["credits"] } }))).toBe("inconnue");
    expect(etatQuestion(q("credits_liste"), etat({}, { profil: { credits: [{ mensualiteFcfa: 5000 }] } }))).toBe("repondue");
  });

  it("finit par le retour au porteur quand tout est répondu, et parcourt les cinq premiers temps dans l'ordre", () => {
    const suite = new Set<string>();
    let e = etat({}, { secteurs: ["vegetal", "animal"] });
    const contexte: Record<string, string> = {};
    for (let i = 0; i < 80; i++) {
      const p = prochaineQuestion(entretien, e);
      if (p.fini) {
        expect(p.temps?.cle).toBe("retour");
        break;
      }
      suite.add(p.temps!.cle);
      const question = p.question!;
      // Répond « je ne sais pas » à tout : l'entretien doit se terminer.
      if (question.remplit.cible === "contexte") contexte[question.remplit.champ] = VALEUR_INCONNUE;
      else if (question.remplit.cible === "profil") e = { ...e, profil: { ...e.profil, inconnus: [...e.profil.inconnus, question.remplit.champ as never] } };
      else e = { ...e, profil: { ...e.profil, inconnus: [...e.profil.inconnus, question.remplit.cible] } };
      e = { ...e, contexte: { ...contexte } };
      if (i === 79) throw new Error("l'entretien ne se termine pas");
    }
    expect([...suite]).toEqual(["idee", "existant", "menage", "marche", "contraintes"]);
  });
});

describe("point de faisabilité", () => {
  const pointDe = (e: EtatEntretien) => Object.fromEntries(pointDeFaisabilite(entretien, e).dimensions.map((d) => [d.dimension, d]));

  it("sans aucune réponse : tout est gris, avec la liste de ce qui manque, sans rien inventer", () => {
    const p = pointDeFaisabilite(entretien, etat());
    expect(p.feuGlobal).toBe("gris");
    for (const d of p.dimensions) {
      expect(d.feu).toBe("gris");
      expect(d.phrase).toMatch(/^(Il manque encore|Pas encore assez)/);
    }
    expect(p.essentielles.traitees).toBe(0);
    expect(p.aValider).toBe(true);
  });

  it("un rouge connu l'emporte même si d'autres réponses manquent", () => {
    const d = pointDe(etat({ eauSource: "aucune" }, { contexte: {} }));
    expect(d.eau.feu).toBe("rouge");
    expect(d.eau.phrase).toMatch(/pas d'eau/);
    expect(pointDeFaisabilite(entretien, etat({ eauSource: "aucune" })).feuGlobal).toBe("rouge");
  });

  it("donne un feu et une phrase par dimension à partir des réponses", () => {
    const e = etat(
      {
        terreStatut: "pret",
        terreSurfaceHa: 2,
        terrePiece: "accord_verbal",
        eauSource: "forage",
        eauSaison: "toute_annee",
        tempsEngagement: "partiel",
        tempsHeuresSemaine: 15,
        familleActifs: 2,
        apportEspecesFcfa: 0,
        menageCoutVieAnnuelFcfa: 900000,
        menageRevenusExterieursAnnuelsFcfa: 0,
        competenceTechnique: "debutant",
      },
      { contexte: { marche_acheteur: "oui_identifie", marche_contrat: "contrat_ecrit", marche_promesse: "ecrite" }, profil: { sansExistant: true, sansCredit: true } },
    );
    const d = pointDe(e);
    expect(d.terre.feu).toBe("orange");
    expect(d.terre.phrase).toMatch(/ne t'appartient pas/);
    expect(d.eau.feu).toBe("vert");
    expect(d.travail.feu).toBe("orange");
    expect(d.argent.feu).toBe("orange");
    expect(d.marche.feu).toBe("vert");
    expect(d.marche.phrase).toMatch(/par écrit/);
    expect(d.savoir_faire.feu).toBe("orange");
    expect(d.regles.feu).toBe("orange");
    expect(d.regles.phrase).toMatch(/pièce écrite/);
  });

  it("« je ne sais pas » sur une question essentielle donne orange, avec une phrase qui le dit", () => {
    const d = pointDe(etat({}, { profil: { inconnus: ["eauSource"] } }));
    expect(d.eau.feu).toBe("orange");
    expect(d.eau.phrase).toMatch(/Tu ne sais pas encore ta source d'eau/);
    expect(d.eau.inconnus).toEqual(["ta source d'eau"]);
  });

  it("vert seulement quand l'essentiel est répondu et qu'aucun signal n'est négatif", () => {
    const e = etat({ eauSource: "puits", eauSaison: "toute_annee" });
    expect(pointDe(e).eau.feu).toBe("vert");
    expect(pointDe(e).eau.phrase).toBe("Tu as de l'eau toute l'année.");
  });

  it("l'acheteur absent ou sans engagement est signalé ; le contrat compte ; l'argent ne dépend pas d'un calcul", () => {
    expect(pointDe(etat({}, { contexte: { marche_acheteur: "cherche" } })).marche.feu).toBe("orange");
    const oral = pointDe(etat({}, { contexte: { marche_acheteur: "oui_identifie", marche_promesse: "orale", marche_contrat: "accord_verbal" } }));
    expect(oral.marche.phrase).toMatch(/à l'oral/);
    const sansCredit = pointDe(etat({ apportEspecesFcfa: 100000, menageCoutVieAnnuelFcfa: 800000, menageRevenusExterieursAnnuelsFcfa: 0 }, { profil: { sansExistant: true, sansCredit: true } }));
    expect(sansCredit.argent.feu).toBe("vert");
    const credits = pointDe(etat({ apportEspecesFcfa: 100000 }, { profil: { credits: [{ mensualiteFcfa: 20000 }] } }));
    expect(credits.argent.phrase).toMatch(/crédits en cours/);
    // Aucun chiffre calculé n'apparaît dans les phrases.
    for (const phrase of Object.values(credits).map((x) => x.phrase)) expect(phrase).not.toMatch(/\d\s?(FCFA|%)/);
  });
});

describe("réponses", () => {
  it("traduit une réponse vers le profil, le contexte, ou les deux (correspondance de l'eau)", () => {
    expect(traduireReponse(q("temps_heures_semaine"), { question: "temps_heures_semaine", valeur: 20 })).toEqual({ profil: { tempsHeuresSemaine: 20 } });
    expect(traduireReponse(q("marche_acheteur"), { question: "marche_acheteur", valeur: "cherche" })).toEqual({ contexte: [{ cle: "marche_acheteur", valeur: "cherche" }] });
    expect(traduireReponse(q("risques"), { question: "risques", valeur: ["prix", "vol"] })).toEqual({ contexte: [{ cle: "risques", valeur: "prix,vol" }] });
    expect(traduireReponse(q("eau_source"), { question: "eau_source", valeur: "forage" })).toEqual({ profil: { eauSource: "forage" }, contexte: [{ cle: "eau", valeur: "forage" }] });
    // Rivière : pas de correspondance, la question « comment amener l'eau » reste à poser.
    expect(traduireReponse(q("eau_source"), { question: "eau_source", valeur: "cours_eau" })).toEqual({ profil: { eauSource: "cours_eau" } });
  });

  it("« je ne sais pas » : null dans le profil, « inconnu » dans le contexte, rien d'inventé", () => {
    expect(traduireReponse(q("epargne"), { question: "epargne", neSaitPas: true })).toEqual({ profil: { epargneFcfa: null } });
    expect(traduireReponse(q("marche_acheteur"), { question: "marche_acheteur", neSaitPas: true })).toEqual({ contexte: [{ cle: "marche_acheteur", valeur: VALEUR_INCONNUE }] });
    expect(traduireReponse(q("credits_liste"), { question: "credits_liste", neSaitPas: true })).toEqual({ profil: { credits: null } });
    expect(traduireReponse(q("eau_source"), { question: "eau_source", neSaitPas: true })).toEqual({ profil: { eauSource: null } });
  });

  it("refuse une valeur du mauvais type ou hors des réponses permises", () => {
    for (const [cle, valeur] of [["marche_acheteur", "peut-etre"], ["epargne", -5], ["epargne", "beaucoup"], ["terre_jachere", "oui"], ["finalites", []], ["risques", ["autre", "n'importe quoi"]], ["idee", "  "], ["credits_liste", [{ mensualiteFcfa: -1 }]]] as const) {
      expect(() => traduireReponse(q(cle), { question: cle, valeur })).toThrow(ErreurPlan);
    }
    expect(() => traduireReponse(q("idee"), { question: "idee", valeur: "x".repeat(201) })).toThrow(ErreurPlan);
  });

  it("enregistre en une fois dans le profil et le contexte, puis renvoie l'état à jour", async () => {
    const { client, tables } = fauxClientProfil({ cultisos: [{ id: "exp-1", name: "Ferme", status: "projet", location: null, user_id: "u1" }], ateliers: [], contexte_terrain: [] });
    const apres = await enregistrerReponses(client, "exp-1", entretien, {
      reponses: [
        { question: "eau_source", valeur: "forage" },
        { question: "epargne", valeur: 120000 },
        { question: "terre_sol", neSaitPas: true },
        { question: "marche_acheteur", valeur: "oui_identifie" },
        { question: "existant_liste", valeur: [{ categorie: "materiel", libelle: "Motopompe", etat: "bon" }] },
        { question: "credits_liste", valeur: [] },
      ],
    });
    expect(apres.profil.valeurs.eauSource).toBe("forage");
    expect(apres.profil.valeurs.epargneFcfa).toBe(120000);
    expect(apres.profil.inconnus).toEqual(["terreSol"]);
    expect(apres.profil.existant).toHaveLength(1);
    expect(apres.profil.sansCredit).toBe(true);
    expect(apres.contexte).toEqual({ eau: "forage", marche_acheteur: "oui_identifie" });
    expect(tables.contexte_terrain).toHaveLength(2);
    // La prochaine question tient compte de ces réponses.
    expect(etatQuestion(q("marche_contrat"), apres)).toBe("a_poser");
    expect(etatQuestion(q("eau_saison"), apres)).toBe("a_poser");
  });

  it("n'écrit rien si une seule réponse est invalide, ou si la question est inconnue", async () => {
    const { client, tables } = fauxClientProfil({ cultisos: [{ id: "exp-1", name: "Ferme", status: "projet", location: null, user_id: "u1" }], ateliers: [], contexte_terrain: [] });
    await expect(enregistrerReponses(client, "exp-1", entretien, { reponses: [{ question: "epargne", valeur: 5 }, { question: "marche_acheteur", valeur: "n'importe quoi" }] })).rejects.toBeInstanceOf(ErreurPlan);
    await expect(enregistrerReponses(client, "exp-1", entretien, { reponses: [{ question: "inexistante", valeur: 1 }] })).rejects.toThrow(/Question inconnue/);
    await expect(enregistrerReponses(client, "exp-1", entretien, { reponses: [] })).rejects.toBeInstanceOf(ErreurPlan);
    expect(tables.profil_porteur).toHaveLength(0);
    expect(tables.contexte_terrain).toHaveLength(0);
    expect((await lireProfil(client, "exp-1")).existe).toBe(false);
  });
});
