import { useEffect, useState } from "react";
import { useAuthenticatedUser } from "./AuthContext";

type WorkspaceStatus = "loading" | "ready" | "missing" | "error";

export interface WorkspaceState {
  workspaceId: string | null;
  status: WorkspaceStatus;
  error: string | null;
}

const STAFF_ROLES = new Set(["admin", "teacher"]);

export function useWorkspace(): WorkspaceState {
  const user = useAuthenticatedUser();
  const [state, setState] = useState<WorkspaceState>({
    workspaceId: null,
    status: "loading",
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    // Clear the last account's workspace before resolving this account.
    setState({ workspaceId: null, status: "loading", error: null });

    void (async () => {
      try {
        const [{ db }, { doc, getDoc }] = await Promise.all([
          import("./firestore"),
          import("firebase/firestore"),
        ]);
        if (cancelled) return;

        const profile = await getDoc(doc(db, "users", user.uid));
        if (cancelled) return;

        const pointer = profile.data()?.lastWorkspaceId;
        if (typeof pointer !== "string" || !pointer.trim()) {
          setState({ workspaceId: null, status: "missing", error: null });
          return;
        }

        const workspaceId = pointer.trim();
        const membership = await getDoc(doc(db, "schools", workspaceId, "members", user.uid));
        if (cancelled) return;

        const role = membership.data()?.role;
        if (!membership.exists() || typeof role !== "string" || !STAFF_ROLES.has(role.toLowerCase())) {
          setState({ workspaceId: null, status: "missing", error: null });
          return;
        }

        setState({ workspaceId, status: "ready", error: null });
      } catch (error) {
        if (cancelled) return;
        setState({
          workspaceId: null,
          status: "error",
          error: error instanceof Error ? error.message : "Could not verify workspace access.",
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user.uid]);

  return state;
}
