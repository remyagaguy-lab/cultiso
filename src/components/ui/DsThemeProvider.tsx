"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { ConfigProvider } from "antd";
import { antdThemes } from "@/lib/ds/antd-theme";

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

export type CultisoThemeMode = "light" | "dark";

export function setCultisoTheme(mode: CultisoThemeMode | "system") {
  if (typeof document === "undefined") return;
  try {
    if (mode === "system") {
      localStorage.removeItem("cultiso-theme");
      const prefersDark =
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches;
      document.documentElement.setAttribute("data-theme", prefersDark ? "dark" : "light");
    } else {
      localStorage.setItem("cultiso-theme", mode);
      document.documentElement.setAttribute("data-theme", mode);
    }
  } catch {
    // Stockage indisponible
  }
}

/**
 * Applique le thème du design system Orkedio (marque Cultiso, clair ou nuit) à Ant Design
 * et reste synchronisé avec l'attribut data-theme de <html>.
 */
export default function DsThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<CultisoThemeMode>("light");

  useIsomorphicLayoutEffect(() => {
    const root = document.documentElement;
    const read = () => setMode(root.getAttribute("data-theme") === "dark" ? "dark" : "light");
    read();

    const mq =
      typeof window.matchMedia === "function"
        ? window.matchMedia("(prefers-color-scheme: dark)")
        : null;

    const onChange = () => {
      try {
        const stored = localStorage.getItem("cultiso-theme");
        if (stored === "light" || stored === "dark") return;
      } catch {
        // Ignore
      }
      if (mq) {
        root.setAttribute("data-theme", mq.matches ? "dark" : "light");
      }
    };

    mq?.addEventListener("change", onChange);
    const obs = new MutationObserver(read);
    obs.observe(root, { attributes: true, attributeFilter: ["data-theme"] });

    return () => {
      mq?.removeEventListener("change", onChange);
      obs.disconnect();
    };
  }, []);

  return <ConfigProvider theme={antdThemes[mode]}>{children}</ConfigProvider>;
}
