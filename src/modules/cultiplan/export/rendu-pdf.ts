// Rendu PDF du document exporté, avec pdfkit (JavaScript pur, polices de base : accents français pris en charge).
// Mise en page simple et lisible : A4, titres, paragraphes, tableaux avec en-tête répété à chaque page, pied de page numéroté.
import PDFDocument from "pdfkit";
import type { Bloc, DocumentExport, SectionDocument } from "./types";

const SARCELLE = "#007468";
const GRIS = "#5b5b5b";
const FILET = "#d9d9d9";
const MARGE = 50;

/** Police de base : on remplace ce qu'elle ne sait pas dessiner. */
const sur = (t: string): string => t.replace(/[  ]/g, " ").replace(/[→]/g, "->").replace(/[≥]/g, ">=").replace(/[≤]/g, "<=");

type Doc = InstanceType<typeof PDFDocument>;

function titre(doc: Doc, texte: string, taille: number, couleur = SARCELLE): void {
  doc.fillColor(couleur).font("Helvetica-Bold").fontSize(taille).text(sur(texte), { width: doc.page.width - 2 * MARGE }).moveDown(0.4);
  doc.fillColor("#1b1b1b").font("Helvetica").fontSize(10);
}

function assurerPlace(doc: Doc, hauteur: number): void {
  if (doc.y + hauteur > doc.page.height - MARGE - 20) doc.addPage();
}

function tableau(doc: Doc, entetes: string[], lignes: string[][], gras: Set<number>, legende?: string): void {
  const largeurUtile = doc.page.width - 2 * MARGE;
  const n = entetes.length;
  const taille = n > 9 ? 6.5 : n > 6 ? 7.5 : 9;
  const poidsPremiere = n >= 3 ? 1.7 : 1.2;
  const poids = entetes.map((_, i) => (i === 0 ? poidsPremiere : 1));
  const total = poids.reduce((s, x) => s + x, 0);
  const largeurs = poids.map((p) => (p / total) * largeurUtile);
  const rembourrage = 3;

  const hauteurLigne = (cellules: string[], police: string): number => {
    doc.font(police).fontSize(taille);
    return Math.max(...cellules.map((c, i) => doc.heightOfString(sur(c), { width: largeurs[i] - 2 * rembourrage }))) + 2 * rembourrage;
  };
  const dessiner = (cellules: string[], police: string, fond?: string): void => {
    const h = hauteurLigne(cellules, police);
    if (doc.y + h > doc.page.height - MARGE - 20) {
      doc.addPage();
      dessiner(entetes, "Helvetica-Bold", "#f3f7f6");
    }
    const y = doc.y;
    let x = MARGE;
    if (fond) doc.rect(MARGE, y, largeurUtile, h).fill(fond);
    doc.fillColor("#1b1b1b").font(police).fontSize(taille);
    cellules.forEach((c, i) => {
      doc.text(sur(c), x + rembourrage, y + rembourrage, { width: largeurs[i] - 2 * rembourrage, lineBreak: true });
      x += largeurs[i];
    });
    doc.moveTo(MARGE, y + h).lineTo(MARGE + largeurUtile, y + h).strokeColor(FILET).lineWidth(0.5).stroke();
    doc.x = MARGE;
    doc.y = y + h;
  };

  if (legende) {
    assurerPlace(doc, 40);
    doc.fillColor("#1b1b1b").font("Helvetica-Bold").fontSize(9).text(sur(legende), MARGE, doc.y, { width: largeurUtile }).moveDown(0.2);
  }
  assurerPlace(doc, hauteurLigne(entetes, "Helvetica-Bold") + (lignes[0] ? hauteurLigne(lignes[0], "Helvetica") : 0));
  dessiner(entetes, "Helvetica-Bold", "#f3f7f6");
  lignes.forEach((l, i) => dessiner(l, gras.has(i) ? "Helvetica-Bold" : "Helvetica"));
  doc.moveDown(0.8);
  doc.x = MARGE;
  doc.fillColor("#1b1b1b").font("Helvetica").fontSize(10);
}

function bloc(doc: Doc, b: Bloc): void {
  const largeur = doc.page.width - 2 * MARGE;
  doc.x = MARGE;
  switch (b.type) {
    case "paragraphe":
      doc.fillColor("#1b1b1b").font("Helvetica").fontSize(10).text(sur(b.texte), MARGE, doc.y, { width: largeur, align: "left" }).moveDown(0.6);
      break;
    case "liste":
      for (const i of b.items) doc.fillColor("#1b1b1b").font("Helvetica").fontSize(10).text(`- ${sur(i)}`, MARGE + 8, doc.y, { width: largeur - 8 }).moveDown(0.25);
      doc.moveDown(0.4);
      break;
    case "definitions":
      for (const l of b.lignes) {
        doc.font("Helvetica-Bold").fontSize(9.5).fillColor("#1b1b1b").text(sur(l.terme), MARGE, doc.y, { width: largeur, continued: true });
        doc.font("Helvetica").text(`  ${sur(l.definition)}`, { width: largeur }).moveDown(0.3);
      }
      break;
    case "cle_valeur":
      tableau(doc, ["Rubrique", "Information"], b.lignes.map(([k, v]) => [k, v]), new Set());
      break;
    case "tableau":
      tableau(doc, b.entetes, b.lignes, new Set(b.gras ?? []), b.legende);
      break;
    case "alerte": {
      const etiquette = b.niveau === "bloquant" ? "Bloquant : " : b.niveau === "alerte" ? "Attention : " : "";
      doc.fillColor(b.niveau === "info" ? GRIS : "#9a3412").font("Helvetica-Oblique").fontSize(9.5).text(`${etiquette}${sur(b.texte)}`, MARGE, doc.y, { width: largeur }).moveDown(0.6);
      doc.fillColor("#1b1b1b").font("Helvetica").fontSize(10);
      break;
    }
    case "case_a_cocher":
      for (const i of b.items) {
        doc.fillColor("#1b1b1b").font("Helvetica-Bold").fontSize(10).text(`${i.coche ? "[x]" : "[ ]"} ${sur(i.texte)}`, MARGE, doc.y, { width: largeur });
        if (i.detail) doc.fillColor(GRIS).font("Helvetica").fontSize(9).text(sur(i.detail), MARGE + 18, doc.y, { width: largeur - 18 });
        doc.moveDown(0.3);
      }
      doc.fillColor("#1b1b1b").font("Helvetica").fontSize(10).moveDown(0.3);
      break;
  }
}

function section(doc: Doc, s: SectionDocument, premiere: boolean): void {
  if (s.nouvellePage && !premiere) doc.addPage();
  else assurerPlace(doc, 80);
  titre(doc, `${s.numero ? `${s.numero}. ` : ""}${s.titre}`, 15);
  for (const b of s.blocs) bloc(doc, b);
  doc.moveDown(0.5);
}

/** Génère le PDF du document. */
export function rendrePdf(document: DocumentExport): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: MARGE, bufferPages: true, info: { Title: sur(document.titre), Creator: "Cultiso" } });
    const morceaux: Buffer[] = [];
    doc.on("data", (m: Buffer) => morceaux.push(m));
    doc.on("end", () => resolve(Buffer.concat(morceaux)));
    doc.on("error", reject);

    // Page de titre
    doc.moveDown(6);
    titre(doc, document.titre, 24);
    doc.fillColor(GRIS).font("Helvetica").fontSize(12).text(sur(document.sousTitre), MARGE, doc.y, { width: doc.page.width - 2 * MARGE }).moveDown(2);
    tableau(doc, ["Rubrique", "Information"], document.pageDeTitre, new Set());

    document.sections.forEach((s, i) => section(doc, { ...s, nouvellePage: s.nouvellePage ?? i === 0 }, false));

    if (document.aCompleter.length > 0) {
      doc.addPage();
      titre(doc, "Ce qu'il reste à compléter", 15);
      bloc(doc, { type: "liste", items: document.aCompleter });
    }

    // Pied de page numéroté sur toutes les pages
    const pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(pages.start + i);
      const basse = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      doc.fillColor(GRIS).font("Helvetica").fontSize(8).text(`${sur(document.pied)}   |   page ${i + 1} sur ${pages.count}`, MARGE, doc.page.height - 32, { width: doc.page.width - 2 * MARGE, align: "center", lineBreak: false });
      doc.page.margins.bottom = basse;
    }
    doc.end();
  });
}
