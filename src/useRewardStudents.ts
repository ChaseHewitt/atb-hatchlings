import { useEffect, useMemo, useState } from "react";
import type { DocumentData, QueryDocumentSnapshot, Unsubscribe } from "firebase/firestore";
import type { Student } from "./types";

interface RosterStudent {
  id: string;
  name: string;
  room: string;
  grade: string;
}

interface RewardState {
  points: number;
  peak: number;
  species: string | null;
}

export interface RewardStudentsState {
  students: Student[];
  loading: boolean;
  rosterError: string | null;
  rewardsError: string | null;
}

export function useRewardStudents(workspaceId: string, yearId: string | null): RewardStudentsState {
  const [roster, setRoster] = useState<RosterStudent[]>([]);
  const [rewards, setRewards] = useState<Map<string, RewardState>>(new Map());
  const [loading, setLoading] = useState(false);
  const [rosterError, setRosterError] = useState<string | null>(null);
  const [rewardsError, setRewardsError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let unsubscribeRoster: Unsubscribe | undefined;
    let unsubscribeRewards: Unsubscribe | undefined;

    setRoster([]);
    setRewards(new Map());
    setRosterError(null);
    setRewardsError(null);
    setLoading(Boolean(yearId));
    if (!yearId) return;

    void (async () => {
      try {
        const [{ db }, { collection, onSnapshot }] = await Promise.all([
          import("./firestore"),
          import("firebase/firestore"),
        ]);
        if (cancelled) return;

        const yearPath = ["schools", workspaceId, "schoolYears", yearId] as const;
        unsubscribeRoster = onSnapshot(
          collection(db, ...yearPath, "students"),
          (snapshot) => {
            setRoster(snapshot.docs.map(parseRosterStudent).filter((student): student is RosterStudent => student !== null));
            setRosterError(null);
            setLoading(false);
          },
          (error) => {
            setRosterError(error.message);
            setLoading(false);
          },
        );

        unsubscribeRewards = onSnapshot(
          collection(db, ...yearPath, "rewards"),
          (snapshot) => {
            setRewards(new Map(snapshot.docs.map((document) => [document.id, parseReward(document)])));
            setRewardsError(null);
          },
          (error) => setRewardsError(error.message),
        );
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : "Could not load the student display.";
        setRosterError(message);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      unsubscribeRoster?.();
      unsubscribeRewards?.();
    };
  }, [workspaceId, yearId]);

  const students = useMemo(() => roster.map((student) => {
    const reward = rewards.get(student.id);
    return {
      ...student,
      points: reward?.points ?? 0,
      peak: reward?.peak ?? 0,
      species: reward?.species ?? null,
    };
  }), [rewards, roster]);

  return { students, loading, rosterError, rewardsError };
}

function parseRosterStudent(document: QueryDocumentSnapshot<DocumentData>): RosterStudent | null {
  const data = document.data();
  if (data.isWithdrawn === true) return null;
  const firstName = typeof data.firstName === "string" ? data.firstName.trim() : "";
  const lastName = typeof data.lastName === "string" ? data.lastName.trim() : "";
  const name = `${firstName} ${lastName}`.trim();
  if (!name) return null;

  return {
    id: document.id,
    name,
    room: typeof data.roomNumber === "string" ? data.roomNumber : "",
    grade: typeof data.grade === "string" ? data.grade : "",
  };
}

function parseReward(document: QueryDocumentSnapshot<DocumentData>): RewardState {
  const data = document.data();
  const points = nonnegativeNumber(data.points);
  const peak = Math.max(points, nonnegativeNumber(data.peak));
  return {
    points,
    peak,
    species: typeof data.species === "string" && data.species ? data.species : null,
  };
}

function nonnegativeNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : 0;
}
