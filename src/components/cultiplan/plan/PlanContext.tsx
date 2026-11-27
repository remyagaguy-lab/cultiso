"use client";

import { Alert, Skeleton } from "antd";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Plan } from "@/modules/cultiplan";
import { appeler } from "../appeler";

interface Valeur {
  plan: Plan;
  /** Remplace le plan (réponse d'une modification ou d'un recalcul). */
  remplacer: (plan: Plan) => void;
}

const Contexte = createContext<Valeur | null>(null);

/** Le plan chargé une seule fois pour tous les écrans du parcours. */
export function usePlan(): Valeur {
  const v = useContext(Contexte);
  if (!v) throw new Error("usePlan doit être utilisé dans un PlanProvider.");
  return v;
}

export function PlanProvider({ planId, children }: { planId: string; children: ReactNode }) {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    let annule = false;
    appeler<Plan>(`/api/cultiplan/plans/${planId}`)
      .then((p) => !annule && setPlan(p))
      .catch((e: unknown) => {
        if (!annule) setErreur(e instanceof Error ? e.message : "Chargement impossible.");
      });
    return () => {
      annule = true;
    };
  }, [planId]);

  const remplacer = useCallback((p: Plan) => setPlan(p), []);
  const valeur = useMemo(() => (plan ? { plan, remplacer } : null), [plan, remplacer]);

  if (erreur && !plan) return <div className="mx-auto w-full max-w-4xl p-4 sm:p-8"><Alert type="error" showIcon title={erreur} /></div>;
  if (!valeur) return <div className="mx-auto w-full max-w-4xl p-4 sm:p-8"><Skeleton active paragraph={{ rows: 8 }} aria-label="Chargement du plan" /></div>;
  return <Contexte.Provider value={valeur}>{children}</Contexte.Provider>;
}
