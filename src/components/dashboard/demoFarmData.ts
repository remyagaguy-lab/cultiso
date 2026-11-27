export type AtelierStatut = "nominal" | "attention" | "critique";

export interface DemoAtelierRow {
  id: string;
  pole: "vegetal" | "animal" | "transformation" | "negoce";
  poleLabel: string;
  name: string;
  cycleInfo: string;
  progress: number;
  costFcfa: number;
  expectedRevenueFcfa: number;
  status: AtelierStatut;
  statusLabel: string;
  href: string;
}

export interface DemoCashflowPoint {
  month: string;
  reelFcfa: number;
  previsionFcfa: number;
}

export interface DemoDecisionAlert {
  id: string;
  severity: "urgent" | "opportunity" | "info";
  category: string;
  title: string;
  detail: string;
  actionLabel: string;
  href: string;
}

export const DEMO_FARM_SUMMARY = {
  cashBalanceFcfa: 4_850_000,
  cashDeltaPct: "+14,2 %",
  projectedMarginFcfa: 6_420_000,
  marginRatePct: 34,
  cultiplanRoiPct: 28,
  paybackMonths: 11,
  operationalHealthPct: 84,
  activeAlertsCount: 2,
  weatherBadge: "Kpalimé · 31°C · Sol modérément sec (48h)",
} as const;

export const DEMO_CASHFLOW_SERIES: DemoCashflowPoint[] = [
  { month: "Juin", reelFcfa: 1_950_000, previsionFcfa: 1_800_000 },
  { month: "Juil", reelFcfa: 2_380_000, previsionFcfa: 2_250_000 },
  { month: "Août", reelFcfa: 2_120_000, previsionFcfa: 2_400_000 },
  { month: "Sept", reelFcfa: 3_410_000, previsionFcfa: 3_150_000 },
  { month: "Oct", reelFcfa: 4_190_000, previsionFcfa: 3_900_000 },
  { month: "Nov", reelFcfa: 4_850_000, previsionFcfa: 4_600_000 },
];

export const DEMO_ATELIERS: DemoAtelierRow[] = [
  {
    id: "veg-mais",
    pole: "vegetal",
    poleLabel: "Végétal",
    name: "Maïs hybride (6 ha)",
    cycleInfo: "Maturation · Récolte J-18",
    progress: 78,
    costFcfa: 1_650_000,
    expectedRevenueFcfa: 3_240_000,
    status: "nominal",
    statusLabel: "Nominal",
    href: "/cultima?view=vegetal",
  },
  {
    id: "veg-tomate",
    pole: "vegetal",
    poleLabel: "Végétal",
    name: "Tomate irriguée (2 ha)",
    cycleInfo: "Floraison · Traitement J+1",
    progress: 54,
    costFcfa: 1_120_000,
    expectedRevenueFcfa: 2_650_000,
    status: "attention",
    statusLabel: "Suivi hydrique",
    href: "/cultima?view=vegetal",
  },
  {
    id: "ani-chair",
    pole: "animal",
    poleLabel: "Élevage",
    name: "Poulet de chair (1 500 sujets)",
    cycleInfo: "Bande B-14 · J+24 / 42",
    progress: 57,
    costFcfa: 2_180_000,
    expectedRevenueFcfa: 3_450_000,
    status: "critique",
    statusLabel: "Provende < 4 j",
    href: "/cultima?view=animal",
  },
  {
    id: "ani-pondeuses",
    pole: "animal",
    poleLabel: "Élevage",
    name: "Pondeuses (800 sujets)",
    cycleInfo: "Pic de ponte · 86 %",
    progress: 82,
    costFcfa: 1_890_000,
    expectedRevenueFcfa: 3_120_000,
    status: "nominal",
    statusLabel: "Nominal",
    href: "/cultima?view=animal",
  },
  {
    id: "trans-unite",
    pole: "transformation",
    poleLabel: "Transformation",
    name: "Unité Farine & Purée",
    cycleInfo: "Lot T-09 · Rendement 74 %",
    progress: 68,
    costFcfa: 940_000,
    expectedRevenueFcfa: 1_740_000,
    status: "nominal",
    statusLabel: "En production",
    href: "/cultima?view=transformation",
  },
];

export const DEMO_DECISION_ALERTS: DemoDecisionAlert[] = [
  {
    id: "alert-provende",
    severity: "urgent",
    category: "Stock · Élevage",
    title: "Provende croissance < 4 jours",
    detail: "Le silo de la bande B-14 (1 500 sujets) passe sous le seuil critique vendredi.",
    actionLabel: "Ouvrir Élevage",
    href: "/cultima?view=animal",
  },
  {
    id: "alert-marche",
    severity: "opportunity",
    category: "Opportunité · Marchés",
    title: "Maïs en hausse (+12 % à Lomé)",
    detail: "Cours favorable pour verrouiller une pré-vente sur 40 % de la récolte à venir.",
    actionLabel: "Voir les cours",
    href: "/marches",
  },
  {
    id: "alert-tomate",
    severity: "info",
    category: "Calendrier · Végétal",
    title: "Traitement préventif Tomate demain",
    detail: "Fenêtre météo sèche idéale entre 06h et 09h sur la parcelle irriguée.",
    actionLabel: "Voir Végétal",
    href: "/cultima?view=vegetal",
  },
];
