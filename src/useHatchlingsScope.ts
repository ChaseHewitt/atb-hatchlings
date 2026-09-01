import { useEffect, useState } from "react";
import type { Unsubscribe } from "firebase/firestore";

export type HatchlingsScope = "morning" | "afternoon" | "both";

/**
 * Which program block earns points, from the iOS app's Hatchlings settings.
 * Stored on the school document as `hatchlingsBlock`, alongside
 * `hatchlingsHatchAt` and `hatchlingsTheme`.
 *
 * Defaults to "afternoon", matching the app: every workspace predates the
 * field, and the afternoon programme is the one that existed before the
 * morning/afternoon split.
 */
export function useHatchlingsScope(workspaceId: string): HatchlingsScope {
  const [scope, setScope] = useState<HatchlingsScope>("afternoon");

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: Unsubscribe | undefined;
    setScope("afternoon");

    void (async () => {
      const [{ db }, { doc, onSnapshot }] = await Promise.all([
        import("./firestore"),
        import("firebase/firestore"),
      ]);
      if (cancelled) return;

      unsubscribe = onSnapshot(doc(db, "schools", workspaceId), (snapshot) => {
        const stored = snapshot.data()?.hatchlingsBlock;
        setScope(
          stored === "morning" || stored === "both" || stored === "afternoon" ? stored : "afternoon",
        );
      });
    })();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [workspaceId]);

  return scope;
}
