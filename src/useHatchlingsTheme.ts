import { useEffect, useState } from "react";
import type { Unsubscribe } from "firebase/firestore";

/**
 * The sprite theme the school picked in the iOS app's Hatchlings settings.
 * Stored on the school document next to hatchlingsHatchAt; "Classic" is the
 * flat /sprites folder, any other value is the /sprites/<theme>/ subfolder.
 */
export function useHatchlingsTheme(workspaceId: string): string {
  const [theme, setTheme] = useState("Classic");

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: Unsubscribe | undefined;
    setTheme("Classic");

    void (async () => {
      const [{ db }, { doc, onSnapshot }] = await Promise.all([
        import("./firestore"),
        import("firebase/firestore"),
      ]);
      if (cancelled) return;

      unsubscribe = onSnapshot(doc(db, "schools", workspaceId), (snapshot) => {
        const stored = snapshot.data()?.hatchlingsTheme;
        setTheme(typeof stored === "string" && stored.trim() !== "" ? stored : "Classic");
      });
    })();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [workspaceId]);

  return theme;
}
