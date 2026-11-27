// Rendu HTML du document exporté (aperçu et impression). Pur : texte échappé, aucune ressource externe, feuille de style intégrée.
import type { Bloc, DocumentExport, SectionDocument } from "./types";

const echapper = (t: string): string => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const NIVEAU: Record<"info" | "alerte" | "bloquant", string> = { info: "Information", alerte: "Attention", bloquant: "Bloquant" };

function bloc(b: Bloc): string {
  switch (b.type) {
    case "paragraphe":
      return `<p>${echapper(b.texte)}</p>`;
    case "liste":
      return `<ul>${b.items.map((i) => `<li>${echapper(i)}</li>`).join("")}</ul>`;
    case "definitions":
      return `<dl>${b.lignes.map((l) => `<dt>${echapper(l.terme)}</dt><dd>${echapper(l.definition)}</dd>`).join("")}</dl>`;
    case "cle_valeur":
      return `<table class="kv">${b.lignes.map(([k, v]) => `<tr><th scope="row">${echapper(k)}</th><td>${echapper(v)}</td></tr>`).join("")}</table>`;
    case "tableau": {
      const gras = new Set(b.gras ?? []);
      return `<table>${b.legende ? `<caption>${echapper(b.legende)}</caption>` : ""}<thead><tr>${b.entetes.map((e) => `<th scope="col">${echapper(e)}</th>`).join("")}</tr></thead><tbody>${b.lignes
        .map((l, i) => `<tr${gras.has(i) ? ' class="total"' : ""}>${l.map((c) => `<td>${echapper(c)}</td>`).join("")}</tr>`)
        .join("")}</tbody></table>`;
    }
    case "alerte":
      return `<p class="alerte ${b.niveau}"><strong>${NIVEAU[b.niveau]} :</strong> ${echapper(b.texte)}</p>`;
    case "case_a_cocher":
      return `<ul class="cases">${b.items.map((i) => `<li><span aria-hidden="true">${i.coche ? "&#9745;" : "&#9744;"}</span> <span class="sr">${i.coche ? "Fourni :" : "À fournir :"}</span> ${echapper(i.texte)}${i.detail ? `<small> ${echapper(i.detail)}</small>` : ""}</li>`).join("")}</ul>`;
  }
}

function section(s: SectionDocument): string {
  return `<section${s.nouvellePage ? ' class="page"' : ""}><h2>${s.numero ? `${echapper(s.numero)}. ` : ""}${echapper(s.titre)}</h2>${s.blocs.map(bloc).join("")}</section>`;
}

const STYLE = `
:root{--sarcelle:#007468;--encre:#1b1b1b;--gris:#5b5b5b;--filet:#d9d9d9}
*{box-sizing:border-box}
body{font-family:"Plus Jakarta Sans",Arial,Helvetica,sans-serif;color:var(--encre);margin:0 auto;max-width:960px;padding:32px;line-height:1.5;font-size:14px}
h1{font-size:28px;margin:0 0 4px;color:var(--sarcelle)} h2{font-size:20px;margin:32px 0 12px;color:var(--sarcelle)}
.sous-titre{color:var(--gris);margin:0 0 24px}
table{width:100%;border-collapse:collapse;margin:12px 0;font-size:12px}
caption{text-align:left;font-weight:600;padding:6px 0}
th,td{border-bottom:1px solid var(--filet);padding:6px 8px;text-align:left;vertical-align:top}
thead th{background:#f3f7f6}
tr.total td{font-weight:700}
.kv th{width:34%;font-weight:600;background:#f3f7f6}
dl{margin:0} dt{font-weight:600;margin-top:8px} dd{margin:0 0 4px}
.alerte{padding:8px 12px;background:#f6f6f6;border-radius:6px}
.alerte.alerte{background:#fff4e5} .alerte.bloquant{background:#fde8e8}
.cases{list-style:none;padding:0} .cases li{margin:6px 0} .cases small{color:var(--gris)}
.sr{position:absolute;left:-9999px}
footer{margin-top:40px;color:var(--gris);font-size:12px;border-top:1px solid var(--filet);padding-top:8px}
@media print{.page{break-before:page} body{padding:0;max-width:none} table{break-inside:auto} tr{break-inside:avoid}}
`;

export function rendreHtml(doc: DocumentExport): string {
  const aCompleter =
    doc.aCompleter.length > 0
      ? `<section class="page"><h2>Ce qu'il reste à compléter</h2><ul>${doc.aCompleter.map((x) => `<li>${echapper(x)}</li>`).join("")}</ul></section>`
      : "";
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${echapper(doc.titre)}</title><meta name="viewport" content="width=device-width, initial-scale=1"><style>${STYLE}</style></head><body><header><h1>${echapper(doc.titre)}</h1><p class="sous-titre">${echapper(doc.sousTitre)}</p><table class="kv">${doc.pageDeTitre
    .map(([k, v]) => `<tr><th scope="row">${echapper(k)}</th><td>${echapper(v)}</td></tr>`)
    .join("")}</table></header><main>${doc.sections.map(section).join("")}${aCompleter}</main><footer>${echapper(doc.pied)}</footer></body></html>`;
}
