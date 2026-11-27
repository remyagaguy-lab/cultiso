/**
 * @jest-environment node
 *
 * Essai avec le VRAI modèle configuré dans .env.local (CULTISIA_FOURNISSEUR), sur une fausse base.
 * Ignoré dans `npm test`. Lancement : `npm run test:modele-reel`. Peut coûter des crédits si le fournisseur est payant.
 */
import { VERSION_MOTEURS } from "@/moteurs";
import { CreditsEnMemoire } from "../credits";
import { creerModeleConfigure } from "../llm/compatible-openai";
import { lancerCultisia } from "../orchestrateur";
import { registreParDefaut } from "../outils";
import { fausseBase } from "../test-utils/fausse-base";
import { collecter, texteDe } from "../test-utils/utilitaires";

const actif = process.env.CULTISIA_MODELE_REEL === "1";
const decrire = actif ? describe : describe.skip;

decrire("essai avec le vrai modèle", () => {
  jest.setTimeout(60000);
  const dependances = () => {
    const { modele, nomModele } = creerModeleConfigure();
    return { modele, nomModele, registre: registreParDefaut(), credits: new CreditsEnMemoire(), donnees: fausseBase() };
  };

  it("répond à une question de prix avec l'outil lire_prix et cite la source", async () => {
    const evenements = await collecter(
      await lancerCultisia(
        { module: "cultisia", utilisateurId: "essai", messages: [{ role: "user", content: "Quel est le prix du maïs à Lomé ?" }] },
        dependances(),
      ),
    );
    const texte = texteDe(evenements);
    console.log("Réponse :", texte, "\nFin :", JSON.stringify(evenements.at(-1)));
    expect(evenements.some((e) => e.type === "sources")).toBe(true);
    expect(texte).toMatch(/350/);
    expect(evenements.at(-1)).toMatchObject({ type: "done" });
  });

  it("propose une opération dans Cultima sans calculer le montant lui-même", async () => {
    const evenements = await collecter(
      await lancerCultisia(
        { module: "cultima", utilisateurId: "essai", messages: [{ role: "user", content: "J'ai acheté 4 sacs d'engrais à 18 000 FCFA le sac" }] },
        dependances(),
      ),
    );
    const action = evenements.find((e) => e.type === "action_proposee");
    console.log("Action :", JSON.stringify(action));
    expect(action).toMatchObject({ outil: "saisir_operation", arguments: { amount: 72000, type: "expense" } });
  });

  it("calcule un crédit avec l'outil calculer_credit et restitue la mensualité du moteur", async () => {
    const evenements = await collecter(
      await lancerCultisia(
        {
          module: "cultiplan",
          utilisateurId: "essai",
          messages: [{ role: "user", content: "Je veux emprunter 1 000 000 FCFA à 24 % par an sur 12 mois. Quelle sera ma mensualité ?" }],
        },
        dependances(),
      ),
    );
    const texte = texteDe(evenements);
    console.log("Réponse :", texte);
    // L'outil serveur a tourné : sa source (le moteur de crédit) est diffusée.
    expect(evenements).toEqual(
      expect.arrayContaining([{ type: "sources", sources: [{ file_name: `Moteur de crédit Cultiso (version ${VERSION_MOTEURS})`, origine: "moteur" }] }]),
    );
    // Mensualité du moteur : 94 560 FCFA (séparateur de milliers libre).
    expect(texte.replace(/[\s .  ]/g, "")).toContain("94560");
  });
});
