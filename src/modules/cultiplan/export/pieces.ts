// Liste des pièces à joindre, cochée selon ce que le porteur a déclaré (profil R9, débouchés). Une pièce n'est cochée que si le porteur
// a dit l'avoir ; sinon elle reste à fournir. Les pièces exigées par le financeur viennent de `ref.regles_financeurs`.
// Liste de base : DOC-00006 p. 27 (pièce foncière, pro forma, contrats ou lettres d'intention, CV, statuts) ; Canevas ANPGF §2.4, §3, §9.
import { valeur } from "../profil";
import type { DonneesDossier } from "./types";

export interface PieceAJoindre {
  code: string;
  libelle: string;
  /** « declaree » : le porteur dit l'avoir ; « a_fournir » : à réunir. */
  etat: "declaree" | "a_fournir";
  detail: string;
  /** « base » : liste de départ ; « financeur » : exigée par le financeur choisi. */
  origine: "base" | "financeur";
}

const PIECES_FONCIERES_VALIDES = new Set(["titre_foncier", "attestation_villageoise", "contrat_ecrit"]);
const LIBELLE_PIECE_FONCIERE: Record<string, string> = {
  titre_foncier: "titre foncier",
  attestation_villageoise: "attestation villageoise",
  contrat_ecrit: "contrat écrit (bail ou accord)",
  accord_verbal: "accord verbal seulement",
  aucune: "aucune pièce",
};

export function listerPieces(d: Pick<DonneesDossier, "profil" | "debouches" | "financeur">): PieceAJoindre[] {
  const pieceFonciere = valeur<string>(d.profil, "terrePiece");
  const statutFoncier = valeur<string>(d.profil, "terreStatut");
  const pieces: PieceAJoindre[] = [];

  pieces.push({
    code: "foncier",
    libelle: "Pièce foncière ou bail",
    etat: pieceFonciere !== null && PIECES_FONCIERES_VALIDES.has(pieceFonciere) ? "declaree" : "a_fournir",
    detail:
      pieceFonciere === null
        ? "Non renseignée : à demander au porteur."
        : PIECES_FONCIERES_VALIDES.has(pieceFonciere)
          ? `Déclarée : ${LIBELLE_PIECE_FONCIERE[pieceFonciere]}${statutFoncier ? ` (statut foncier : ${statutFoncier.replace(/_/g, " ")})` : ""}.`
          : `Le porteur n'a que : ${LIBELLE_PIECE_FONCIERE[pieceFonciere] ?? pieceFonciere}. Une pièce écrite est à obtenir.`,
    origine: "base",
  });
  pieces.push({ code: "pro_forma", libelle: "Factures pro forma des investissements", etat: "a_fournir", detail: "À demander aux fournisseurs pour chaque investissement du tableau 10.1.", origine: "base" });
  const contrats = d.debouches?.contrats ?? [];
  pieces.push({
    code: "contrats",
    libelle: "Contrats ou lettres d'intention des acheteurs",
    etat: "a_fournir",
    detail:
      contrats.length > 0
        ? `Un contrat est prévu avec ${contrats.map((c) => c.acheteur).join(", ")} : joindre l'exemplaire signé.`
        : "Aucun acheteur n'est nommé : joindre au moins une lettre d'intention si elle existe.",
    origine: "base",
  });
  pieces.push({ code: "cv", libelle: "CV du promoteur", etat: "a_fournir", detail: "Parcours et compétences du promoteur.", origine: "base" });
  pieces.push({ code: "statuts", libelle: "Statuts ou récépissé de la structure", etat: "a_fournir", detail: "Pour un groupement ou une société ; sans objet pour une exploitation individuelle.", origine: "base" });

  for (const p of d.financeur?.piecesExigees ?? []) {
    pieces.push({ code: `financeur:${p}`, libelle: p, etat: "a_fournir", detail: `Exigée par ${d.financeur?.organisme}.`, origine: "financeur" });
  }
  return pieces;
}
