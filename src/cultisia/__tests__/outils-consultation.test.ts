/** @jest-environment node */
// S3 : Cultisia mène la consultation de cadrage avec les questions du référentiel, sans rien calculer ni enregistrer elle-même.
import type { EtatEntretien } from "@/modules/cultiplan/entretien";
import { pointDeFaisabilite, prochaineQuestion } from "@/modules/cultiplan/entretien";
import { entretienDeDepart } from "@/modules/cultiplan/test-utils/entretien-depart";
import { ProfilPorteurVide } from "@/modules/cultiplan/test-utils/profil-vide";
import { ErreurReferentiel } from "@/referentiel";
import type { AccesDonnees } from "../donnees";
import { registreParDefaut } from "../outils";
import { noterReponsesConsultation, pointDeFaisabiliteOutil, prochaineQuestionConsultation } from "../outils/consultation";
import type { ContexteOutil } from "../outils/registre";
import { fausseBase } from "../test-utils/fausse-base";

const entretien = entretienDeDepart();
const etat = (valeurs: Parameters<typeof ProfilPorteurVide>[0] = {}, contexte: Record<string, string> = {}): EtatEntretien => ({ profil: ProfilPorteurVide(valeurs), contexte });
const contexte = (surcharges: Partial<AccesDonnees>, exploitationId = "exp-1"): ContexteOutil => ({
  module: "cultiplan",
  utilisateurId: "u1",
  exploitationId,
  donnees: fausseBase(surcharges),
});
const lireConsultation = (e: EtatEntretien) => async (id: string) => (id === "exp-1" ? { entretien, etat: e } : null);

let espion: jest.SpyInstance;
beforeEach(() => (espion = jest.spyOn(console, "error").mockImplementation(() => {})));
afterEach(() => espion.mockRestore());

describe("prochaine_question_consultation", () => {
  it("pose la première question du référentiel avec le type de réponse et les consignes", async () => {
    const r = await prochaineQuestionConsultation.executer!({}, contexte({ lireConsultation: lireConsultation(etat()) }));
    const attendue = prochaineQuestion(entretien, etat()).question!;
    expect(r.contenu).toContain("temps 1 sur 6 : Ton idée et toi");
    expect(r.contenu).toContain(`(clé ${attendue.cle}) : ${attendue.libelle}`);
    expect(r.contenu).toContain("Introduction du temps");
    expect(r.contenu).toContain("« je ne sais pas »");
    expect(r.contenu).toContain("Ne demande jamais combien il vendra");
    expect(r.contenu).toContain("noter_reponses_consultation");
    expect(r.sources?.[0].origine).toBe("referentiel");
  });

  it("décrit les réponses permises pour un choix", async () => {
    const e = etat({}, { idee: "des poulets" });
    const r = await prochaineQuestionConsultation.executer!({}, contexte({ lireConsultation: lireConsultation(e) }));
    expect(r.contenu).toContain("(clé avancement)");
    expect(r.contenu).toContain("un seul choix parmi : idee = « Ce n'est encore qu'une idée »");
  });

  it("annonce la fin et renvoie vers le point de faisabilité quand tout est traité", async () => {
    const fini = etat();
    for (const q of entretien.questions) {
      if (q.remplit.cible === "contexte") fini.contexte[q.remplit.champ] = "inconnu";
      else fini.profil.inconnus.push((q.remplit.cible === "profil" ? q.remplit.champ : q.remplit.cible) as never);
    }
    const r = await prochaineQuestionConsultation.executer!({}, contexte({ lireConsultation: lireConsultation(fini) }));
    expect(r.contenu).toContain("il n'y a plus de question à poser");
    expect(r.contenu).toContain("point_de_faisabilite");
  });

  it("garde-fous : pas d'exploitation, exploitation inaccessible, référentiel absent, panne", async () => {
    expect((await prochaineQuestionConsultation.executer!({}, contexte({ lireConsultation: lireConsultation(etat()) }, ""))).contenu).toMatch(/^AUCUNE EXPLOITATION ACTIVE/);
    expect((await prochaineQuestionConsultation.executer!({}, contexte({ lireConsultation: lireConsultation(etat()) }, "autre"))).contenu).toMatch(/^EXPLOITATION INTROUVABLE/);
    expect((await prochaineQuestionConsultation.executer!({}, contexte({ lireConsultation: undefined }))).contenu).toMatch(/^CONSULTATION NON DISPONIBLE/);
    const referentiel = await prochaineQuestionConsultation.executer!({}, contexte({ lireConsultation: async () => { throw new ErreurReferentiel("table absente"); } }));
    expect(referentiel.contenu).toBe("RÉFÉRENTIEL : table absente");
    const panne = await prochaineQuestionConsultation.executer!({}, contexte({ lireConsultation: async () => { throw new Error("coupure"); } }));
    expect(panne.contenu).toMatch(/^ERREUR D'ACCÈS AUX DONNÉES/);
  });
});

describe("point_de_faisabilite", () => {
  it("restitue le feu et la phrase de chaque dimension tels que le service les établit", async () => {
    const e = etat({ eauSource: "aucune", terreStatut: "propriete", terreSurfaceHa: 1, tempsEngagement: "plein" }, { marche_acheteur: "cherche" });
    const r = await pointDeFaisabiliteOutil.executer!({}, contexte({ lireConsultation: lireConsultation(e) }));
    const point = pointDeFaisabilite(entretien, e);
    for (const d of point.dimensions) expect(r.contenu).toContain(`- ${d.libelle} : `);
    expect(r.contenu).toContain("- L'eau : ROUGE. Tu n'as pas d'eau.");
    expect(r.contenu).toContain("- La terre : VERT. Tu disposes de la terre.");
    expect(r.contenu).toContain("- Le marché : ORANGE. Tu n'as pas encore d'acheteur.");
    expect(r.contenu).toContain("feu d'ensemble : ROUGE");
    expect(r.contenu).toContain("brouillons non encore relus");
    expect(r.contenu).toContain("1) ce que tu as compris");
    expect(r.contenu).toContain("calculer le plan pour les chiffres");
  });

  it("ne dit pas « vert » sans réponses : tout est gris", async () => {
    const r = await pointDeFaisabiliteOutil.executer!({}, contexte({ lireConsultation: lireConsultation(etat()) }));
    expect(r.contenu).toContain("feu d'ensemble : GRIS");
    expect(r.contenu).not.toMatch(/: VERT\./);
  });
});

describe("noter_reponses_consultation (action)", () => {
  const registre = registreParDefaut();

  it("est une action, donc jamais exécutée côté serveur : l'utilisateur confirme", () => {
    expect(noterReponsesConsultation.famille).toBe("action");
    expect(noterReponsesConsultation.executer).toBeUndefined();
    expect(registre.pour("cultiplan").map((o) => o.nom)).toEqual(expect.arrayContaining(["prochaine_question_consultation", "point_de_faisabilite", "noter_reponses_consultation"]));
    expect(registre.pour("cultima").map((o) => o.nom)).not.toContain("noter_reponses_consultation");
  });

  it("valide les arguments : une valeur, ou « je ne sais pas », jamais les deux ni aucun", () => {
    const ok = registre.valider("noter_reponses_consultation", JSON.stringify({ reponses: [{ question: "epargne", valeur: 50000 }, { question: "terre_sol", neSaitPas: true }] }), "cultiplan");
    expect(ok.ok).toBe(true);
    for (const reponses of [[{ question: "epargne" }], [{ question: "epargne", valeur: 1, neSaitPas: true }], []]) {
      expect(registre.valider("noter_reponses_consultation", JSON.stringify({ reponses }), "cultiplan").ok).toBe(false);
    }
  });

  it("prépare le message de confirmation", () => {
    const args = { reponses: [{ question: "epargne", valeur: 1 }, { question: "terre_sol", neSaitPas: true as const }] };
    expect(noterReponsesConsultation.preparer!(args)).toEqual({ reponses: args.reponses });
    expect(noterReponsesConsultation.messagePropose!(args)).toContain("2 réponses");
  });
});
