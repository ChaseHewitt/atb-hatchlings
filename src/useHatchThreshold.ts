import { useEffect, useState } from "react";
import type { Unsubscribe } from "firebase/firestore";
import { HATCH_AT } from "./types";

export function useHatchThreshold(workspaceId: string): number {
  const [threshold, setThreshold] = useState(HATCH_AT);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: Unsubscribe | undefined;
    setThreshold(HATCH_AT);

    void (async () => {
      const [{ db }, { doc, onSnapshot }] = await Promise.all([
        import("./firestore"),
        import("firebase/firestore"),
      ]);
      if (cancelled) return;

      unsubscribe = onSnapshot(doc(db, "schools", workspaceId), (snapshot) => {
        const stored = snapshot.data()?.hatchlingsHatchAt;
        setThreshold(validThreshold(stored));
      });
    })();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [workspaceId]);

  return threshold;
}

function validThreshold(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return HATCH_AT;
  return Math.min(100, Math.max(1, Math.round(value)));
}
