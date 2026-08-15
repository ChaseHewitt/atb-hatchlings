import type { Student } from "./types";
import { rollFromRoster, type Roster } from "./roster";

export async function updateReward(
  workspaceId: string,
  yearId: string,
  student: Student,
  delta: number,
  hatchAt: number,
  roster: Roster,
  /** Creature chosen for this student by planHatchSpecies, when it is hatching. */
  preferredSpecies?: string,
): Promise<void> {
  const [{ db }, { doc, runTransaction, serverTimestamp }] = await Promise.all([
    import("./firestore"),
    import("firebase/firestore"),
  ]);
  const rewardRef = doc(
    db,
    "schools",
    workspaceId,
    "schoolYears",
    yearId,
    "rewards",
    student.id,
  );

  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(rewardRef);
    const current = snapshot.data();
    const currentPoints = nonnegativeNumber(current?.points);
    const points = Math.max(0, currentPoints + delta);
    const peak = Math.max(nonnegativeNumber(current?.peak), points);
    const storedSpecies = current?.species;
    const alreadyHatched = typeof storedSpecies === "string" && storedSpecies !== "";
    const hatchingNow = !alreadyHatched && points >= hatchAt;
    const species = alreadyHatched
      ? storedSpecies
      : hatchingNow
        ? (preferredSpecies ?? rollFromRoster(roster).id)
        : null;
    // Recorded once, at hatch, so the pet keeps its own art after the school
    // switches themes. Existing pets keep whatever is already stored.
    const speciesTheme = alreadyHatched
      ? (current?.speciesTheme ?? null)
      : hatchingNow
        ? roster.theme
        : null;

    transaction.set(rewardRef, {
      name: student.name,
      room: student.room,
      grade: student.grade,
      points,
      peak,
      species,
      speciesTheme,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  });
}

function nonnegativeNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : 0;
}
