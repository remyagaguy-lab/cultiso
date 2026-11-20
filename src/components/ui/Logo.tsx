import React from "react";

/**
 * Logo Cultiso (proposition B « Soleil dans le i », validée le 2026-11-20).
 * On choisit un fichier du kit : aucune couleur recalculée, aucun style en dur.
 * Source : design system Orkedio, fondations/logos/cultiso/ (REGLES-CONSTRUCTION.md).
 *
 * variant : horizontal (principal) | compact (symbole à la hauteur du mot) | vertical | symbol (emblème)
 * size    : xs (emblème XS, 20 px) | sm | md | lg | xl ; horizontal et symbol : hauteur 28/40/56/80 ; compact : 24/32/44/64 ;
 *           vertical : largeur 80/120/160/240
 * tone    : on-light (couleur, sur blanc ou crème) | on-dark (crème et orange clair, sur vert profond ou nuit) | on-color (blanc, sur orange ou photo avec voile)
 */
export type LogoVariant = "horizontal" | "compact" | "vertical" | "symbol";
export type LogoSize = "xs" | "sm" | "md" | "lg" | "xl";
export type LogoTone = "on-light" | "on-dark" | "on-color";

const RATIO = { horizontal: 3.9878, compact: 5.4659, vertical: 1.2644, symbol: 0.9836, xs: 0.9836 } as const;
const HAUTEUR: Record<Exclude<LogoVariant, "vertical">, Record<LogoSize, number>> = {
  horizontal: { xs: 28, sm: 28, md: 40, lg: 56, xl: 80 },
  compact: { xs: 24, sm: 24, md: 32, lg: 44, xl: 64 },
  symbol: { xs: 20, sm: 28, md: 40, lg: 56, xl: 80 },
};
const LARGEUR_VERTICAL: Record<LogoSize, number> = { xs: 80, sm: 80, md: 120, lg: 160, xl: 240 };
const PEAU: Record<LogoTone, string> = { "on-light": "couleur", "on-dark": "sombre", "on-color": "blanc" };

export function logoSpec(variant: LogoVariant, size: LogoSize, tone: LogoTone) {
  const skin = PEAU[tone];
  const xs = variant === "symbol" && size === "xs" && tone !== "on-color";
  const file = variant === "symbol" ? (xs ? `embleme-xs-${skin}` : `embleme-${skin}`) : `logo-${variant}-${skin}`;
  const ratio = xs ? RATIO.xs : RATIO[variant];
  const height = variant === "vertical" ? Math.round(LARGEUR_VERTICAL[size] / ratio) : HAUTEUR[variant][size];
  const width = variant === "vertical" ? LARGEUR_VERTICAL[size] : Math.round(height * ratio);
  return { src: `/logo/kit/${file}.svg`, width, height };
}

export interface LogoProps {
  variant?: LogoVariant;
  size?: LogoSize;
  tone?: LogoTone;
  /** Logo purement décoratif (alt vide), par exemple à côté du nom écrit. */
  decorative?: boolean;
  priority?: boolean;
  className?: string;
}

export function Logo({ variant = "horizontal", size = "md", tone = "on-light", decorative = false, priority = false, className }: LogoProps) {
  const { src, width, height } = logoSpec(variant, size, tone);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} width={width} height={height} alt={decorative ? "" : "Cultiso"} className={className} loading={priority ? "eager" : "lazy"} decoding="async" style={{ display: "block", height: "auto", maxWidth: "100%" }} />
  );
}

export default Logo;
